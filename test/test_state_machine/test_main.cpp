// Host-side tests for app::RefreshMachine.
//
// Drives the state machine through the streaming-upload lifecycle using a
// fake panel and an injectable clock. No Arduino or FreeRTOS runtime is
// required — runs under `pio test -e native`.

#include <unity.h>

#include <cstddef>
#include <cstdint>
#include <cstring>

#include "app/panel.h"
#include "app/refresh_machine.h"

namespace {

constexpr unsigned long kCooldownMs       = 300UL * 1000UL;
constexpr unsigned long kRefreshTimeoutMs = 60UL * 1000UL;

class FakePanel : public app::IPanel {
   public:
    int    begin_count   = 0;
    int    end_count     = 0;
    int    start_count   = 0;
    int    sleep_count   = 0;
    size_t bytes_written = 0;
    bool   busy          = false;

    void begin_frame() override                                 { begin_count++; }
    void write_chunk(const uint8_t* /*d*/, std::size_t n) override { bytes_written += n; }
    void end_frame() override                                   { end_count++; }
    void start_refresh() override                               { start_count++; busy = true; }
    bool is_busy() override                                     { return busy; }
    void sleep() override                                       { sleep_count++; }
};

unsigned long g_now = 0;
unsigned long fake_clock() { return g_now; }

void reset() { g_now = 0; }

}  // namespace

void test_idle_does_nothing_on_tick() {
    reset();
    FakePanel panel;
    app::RefreshMachine m(panel, fake_clock, kCooldownMs, kRefreshTimeoutMs);

    m.tick();

    TEST_ASSERT_EQUAL(int(app::State::IDLE), int(m.state()));
    TEST_ASSERT_EQUAL(0, panel.begin_count);
    TEST_ASSERT_EQUAL(0, panel.start_count);
}

void test_begin_stream_opens_panel() {
    reset();
    FakePanel panel;
    app::RefreshMachine m(panel, fake_clock, kCooldownMs, kRefreshTimeoutMs);

    auto r = m.begin_stream();

    TEST_ASSERT_EQUAL(int(app::RefreshMachine::StreamResult::Ok), int(r));
    TEST_ASSERT_EQUAL(int(app::State::UPLOADING), int(m.state()));
    TEST_ASSERT_EQUAL(1, panel.begin_count);
}

void test_chunks_then_commit_drives_refresh() {
    reset();
    FakePanel panel;
    app::RefreshMachine m(panel, fake_clock, kCooldownMs, kRefreshTimeoutMs);

    TEST_ASSERT_EQUAL(int(app::RefreshMachine::StreamResult::Ok), int(m.begin_stream()));

    uint8_t buf[8] = {0};
    TEST_ASSERT_TRUE(m.write_stream_chunk(buf, 8));
    TEST_ASSERT_TRUE(m.write_stream_chunk(buf, 8));
    TEST_ASSERT_EQUAL(16u, panel.bytes_written);

    m.commit_stream();
    TEST_ASSERT_EQUAL(int(app::State::REFRESHING), int(m.state()));
    TEST_ASSERT_EQUAL(1, panel.end_count);
    TEST_ASSERT_EQUAL(1, panel.start_count);
    TEST_ASSERT_TRUE(panel.busy);
}

void test_abort_stream_returns_to_idle_without_refresh() {
    reset();
    FakePanel panel;
    app::RefreshMachine m(panel, fake_clock, kCooldownMs, kRefreshTimeoutMs);

    m.begin_stream();
    uint8_t buf[4] = {0};
    m.write_stream_chunk(buf, 4);
    m.abort_stream();

    TEST_ASSERT_EQUAL(int(app::State::IDLE), int(m.state()));
    TEST_ASSERT_EQUAL(1, panel.end_count);
    TEST_ASSERT_EQUAL(0, panel.start_count);
    TEST_ASSERT_EQUAL(1, panel.sleep_count);
}

void test_refreshing_waits_until_panel_idle() {
    reset();
    FakePanel panel;
    app::RefreshMachine m(panel, fake_clock, kCooldownMs, kRefreshTimeoutMs);

    m.begin_stream();
    m.commit_stream();  // -> REFRESHING

    g_now += 5000;
    m.tick();
    TEST_ASSERT_EQUAL(int(app::State::REFRESHING), int(m.state()));
    TEST_ASSERT_EQUAL(0, panel.sleep_count);

    panel.busy = false;
    g_now += 1000;
    m.tick();
    TEST_ASSERT_EQUAL(int(app::State::COOLDOWN), int(m.state()));
    TEST_ASSERT_EQUAL(1, panel.sleep_count);
    TEST_ASSERT_FALSE(m.last_refresh_timed_out());
    TEST_ASSERT_EQUAL((g_now / 1000UL), m.last_refresh_uptime_s());
}

void test_refreshing_times_out_if_panel_hangs() {
    reset();
    FakePanel panel;
    app::RefreshMachine m(panel, fake_clock, kCooldownMs, kRefreshTimeoutMs);

    m.begin_stream();
    m.commit_stream();  // panel.busy stays true

    g_now += kRefreshTimeoutMs + 100;
    m.tick();

    TEST_ASSERT_EQUAL(int(app::State::COOLDOWN), int(m.state()));
    TEST_ASSERT_EQUAL(1, panel.sleep_count);
    TEST_ASSERT_TRUE(m.last_refresh_timed_out());
}

void test_begin_stream_during_cooldown_returns_busy() {
    reset();
    FakePanel panel;
    app::RefreshMachine m(panel, fake_clock, kCooldownMs, kRefreshTimeoutMs);

    m.begin_stream();
    m.commit_stream();
    panel.busy = false;
    m.tick();  // -> COOLDOWN

    TEST_ASSERT_EQUAL(int(app::State::COOLDOWN), int(m.state()));
    auto r = m.begin_stream();
    TEST_ASSERT_EQUAL(int(app::RefreshMachine::StreamResult::Busy), int(r));
    TEST_ASSERT_EQUAL(1, panel.begin_count);  // unchanged
}

void test_begin_stream_during_refresh_returns_busy() {
    reset();
    FakePanel panel;
    app::RefreshMachine m(panel, fake_clock, kCooldownMs, kRefreshTimeoutMs);

    m.begin_stream();
    m.commit_stream();  // -> REFRESHING

    auto r = m.begin_stream();
    TEST_ASSERT_EQUAL(int(app::RefreshMachine::StreamResult::Busy), int(r));
}

void test_cooldown_remaining_decreases() {
    reset();
    FakePanel panel;
    app::RefreshMachine m(panel, fake_clock, kCooldownMs, kRefreshTimeoutMs);

    m.begin_stream();
    m.commit_stream();
    panel.busy = false;
    m.tick();  // -> COOLDOWN at g_now=0
    const unsigned long start = g_now;

    TEST_ASSERT_EQUAL(kCooldownMs / 1000UL, m.cooldown_remaining_s());

    g_now = start + 60UL * 1000UL;
    TEST_ASSERT_EQUAL((kCooldownMs - 60UL * 1000UL) / 1000UL, m.cooldown_remaining_s());

    g_now = start + kCooldownMs + 1;
    TEST_ASSERT_EQUAL(0UL, m.cooldown_remaining_s());
}

void test_cooldown_expires_to_idle() {
    reset();
    FakePanel panel;
    app::RefreshMachine m(panel, fake_clock, kCooldownMs, kRefreshTimeoutMs);

    m.begin_stream();
    m.commit_stream();
    panel.busy = false;
    m.tick();  // -> COOLDOWN

    g_now += kCooldownMs + 1;
    m.tick();
    TEST_ASSERT_EQUAL(int(app::State::IDLE), int(m.state()));

    auto r = m.begin_stream();
    TEST_ASSERT_EQUAL(int(app::RefreshMachine::StreamResult::Ok), int(r));
}

int main(int /*argc*/, char** /*argv*/) {
    UNITY_BEGIN();
    RUN_TEST(test_idle_does_nothing_on_tick);
    RUN_TEST(test_begin_stream_opens_panel);
    RUN_TEST(test_chunks_then_commit_drives_refresh);
    RUN_TEST(test_abort_stream_returns_to_idle_without_refresh);
    RUN_TEST(test_refreshing_waits_until_panel_idle);
    RUN_TEST(test_refreshing_times_out_if_panel_hangs);
    RUN_TEST(test_begin_stream_during_cooldown_returns_busy);
    RUN_TEST(test_begin_stream_during_refresh_returns_busy);
    RUN_TEST(test_cooldown_remaining_decreases);
    RUN_TEST(test_cooldown_expires_to_idle);
    return UNITY_END();
}
