// Host-side tests for app::RefreshMachine.
//
// Drives the state machine through the upload + bulk-refresh lifecycle (and
// the queued/coalesced variants) using a fake panel and an injectable clock.
// No Arduino or FreeRTOS runtime is required — runs under `pio test -e native`.

#include <unity.h>

#include <cstddef>
#include <cstdint>
#include <cstring>

#include "app/panel.h"
#include "app/refresh_machine.h"

namespace {

constexpr unsigned long kCooldownMs            = 300UL * 1000UL;
constexpr unsigned long kRefreshTimeoutMs      = 60UL * 1000UL;
constexpr unsigned long kUploadStaleTimeoutMs  = 60UL * 1000UL;

class FakePanel : public app::IPanel {
   public:
    int    begin_count   = 0;
    int    end_count     = 0;
    int    start_count   = 0;
    int    sleep_count   = 0;
    size_t bytes_written = 0;
    bool   busy          = false;
    bool   start_returns = true;  // simulate BUSY drop after refresh cmd

    void begin_frame() override                                    { begin_count++; }
    void write_chunk(const uint8_t* /*d*/, std::size_t n) override { bytes_written += n; }
    void end_frame() override                                      { end_count++; }
    bool start_refresh() override                                  { start_count++; busy = start_returns; return start_returns; }
    bool is_busy() override                                        { return busy; }
    void sleep() override                                          { sleep_count++; }
};

unsigned long g_now = 0;
unsigned long fake_clock() { return g_now; }

void reset() { g_now = 0; }

constexpr std::uint8_t kSeg0[8] = {0};
constexpr std::uint8_t kSeg1[8] = {0};
constexpr const std::uint8_t* kSegs[2] = {kSeg0, kSeg1};
constexpr std::size_t kSegCount  = 2;
constexpr std::size_t kSegBytes  = sizeof(kSeg0);
constexpr std::size_t kTotalBytes = kSegCount * kSegBytes;

app::RefreshMachine make(FakePanel& panel) {
    app::RefreshMachine m(panel, fake_clock, kCooldownMs, kRefreshTimeoutMs,
                          kUploadStaleTimeoutMs);
    m.set_segments(kSegs, kSegCount, kSegBytes);
    return m;
}

}  // namespace

void test_idle_does_nothing_on_tick() {
    reset();
    FakePanel panel;
    auto m = make(panel);

    m.tick();

    TEST_ASSERT_EQUAL(int(app::State::IDLE), int(m.state()));
    TEST_ASSERT_EQUAL(0, panel.begin_count);
    TEST_ASSERT_EQUAL(0, panel.start_count);
    TEST_ASSERT_EQUAL(int(app::RefreshStatus::None), int(m.last_refresh_status()));
    TEST_ASSERT_FALSE(m.pending_frame());
}

void test_begin_stream_does_not_touch_panel() {
    reset();
    FakePanel panel;
    auto m = make(panel);

    auto r = m.begin_stream();

    TEST_ASSERT_EQUAL(int(app::RefreshMachine::BeginResult::Ok), int(r));
    TEST_ASSERT_EQUAL(int(app::State::UPLOADING), int(m.state()));
    TEST_ASSERT_EQUAL(0, panel.begin_count);
}

void test_commit_drives_bulk_refresh() {
    reset();
    FakePanel panel;
    auto m = make(panel);

    m.begin_stream();
    auto r = m.commit_stream();

    TEST_ASSERT_EQUAL(int(app::RefreshMachine::CommitResult::Accepted), int(r));
    TEST_ASSERT_EQUAL(int(app::State::REFRESHING), int(m.state()));
    TEST_ASSERT_EQUAL(1, panel.begin_count);
    TEST_ASSERT_EQUAL(kTotalBytes, panel.bytes_written);
    TEST_ASSERT_EQUAL(1, panel.end_count);
    TEST_ASSERT_EQUAL(1, panel.start_count);
    TEST_ASSERT_TRUE(panel.busy);
    TEST_ASSERT_FALSE(m.pending_frame());
}

void test_commit_with_failed_refresh_returns_failed() {
    reset();
    FakePanel panel;
    panel.start_returns = false;
    auto m = make(panel);

    m.begin_stream();
    auto r = m.commit_stream();

    TEST_ASSERT_EQUAL(int(app::RefreshMachine::CommitResult::Failed), int(r));
    TEST_ASSERT_EQUAL(int(app::State::IDLE), int(m.state()));
    TEST_ASSERT_EQUAL(int(app::RefreshStatus::NotStarted), int(m.last_refresh_status()));
    TEST_ASSERT_EQUAL(1, panel.sleep_count);
}

void test_abort_stream_returns_to_idle_without_panel_io() {
    reset();
    FakePanel panel;
    auto m = make(panel);

    m.begin_stream();
    m.abort_stream();

    TEST_ASSERT_EQUAL(int(app::State::IDLE), int(m.state()));
    TEST_ASSERT_EQUAL(0, panel.begin_count);
    TEST_ASSERT_EQUAL(0, panel.sleep_count);
}

void test_refreshing_waits_until_panel_idle() {
    reset();
    FakePanel panel;
    auto m = make(panel);

    m.begin_stream();
    m.commit_stream();

    g_now += 5000;
    m.tick();
    TEST_ASSERT_EQUAL(int(app::State::REFRESHING), int(m.state()));
    TEST_ASSERT_EQUAL(0, panel.sleep_count);

    panel.busy = false;
    g_now += 1000;
    m.tick();
    TEST_ASSERT_EQUAL(int(app::State::COOLDOWN), int(m.state()));
    TEST_ASSERT_EQUAL(1, panel.sleep_count);
    TEST_ASSERT_EQUAL(int(app::RefreshStatus::Ok), int(m.last_refresh_status()));
    TEST_ASSERT_EQUAL((g_now / 1000UL), m.last_refresh_uptime_s());
}

void test_refreshing_times_out_if_panel_hangs() {
    reset();
    FakePanel panel;
    auto m = make(panel);

    m.begin_stream();
    m.commit_stream();

    g_now += kRefreshTimeoutMs + 100;
    m.tick();

    TEST_ASSERT_EQUAL(int(app::State::COOLDOWN), int(m.state()));
    TEST_ASSERT_EQUAL(1, panel.sleep_count);
    TEST_ASSERT_EQUAL(int(app::RefreshStatus::Timeout), int(m.last_refresh_status()));
}

void test_push_during_refreshing_is_queued() {
    reset();
    FakePanel panel;
    auto m = make(panel);

    m.begin_stream();
    m.commit_stream();
    TEST_ASSERT_EQUAL(int(app::State::REFRESHING), int(m.state()));

    auto r1 = m.begin_stream();
    TEST_ASSERT_EQUAL(int(app::RefreshMachine::BeginResult::Ok), int(r1));
    auto r2 = m.commit_stream();
    TEST_ASSERT_EQUAL(int(app::RefreshMachine::CommitResult::Queued), int(r2));
    TEST_ASSERT_TRUE(m.pending_frame());
    // No additional panel I/O — the original refresh is still in flight.
    TEST_ASSERT_EQUAL(1, panel.begin_count);
    TEST_ASSERT_EQUAL(1, panel.start_count);
}

void test_push_during_cooldown_is_queued() {
    reset();
    FakePanel panel;
    auto m = make(panel);

    m.begin_stream();
    m.commit_stream();
    panel.busy = false;
    m.tick();
    TEST_ASSERT_EQUAL(int(app::State::COOLDOWN), int(m.state()));

    TEST_ASSERT_EQUAL(int(app::RefreshMachine::BeginResult::Ok), int(m.begin_stream()));
    TEST_ASSERT_EQUAL(int(app::RefreshMachine::CommitResult::Queued), int(m.commit_stream()));
    TEST_ASSERT_TRUE(m.pending_frame());
}

void test_queued_frame_fires_when_cooldown_ends() {
    reset();
    FakePanel panel;
    auto m = make(panel);

    m.begin_stream();
    m.commit_stream();
    panel.busy = false;
    m.tick();  // -> COOLDOWN

    m.begin_stream();
    m.commit_stream();  // queued
    TEST_ASSERT_TRUE(m.pending_frame());

    g_now += kCooldownMs + 1;
    m.tick();

    TEST_ASSERT_EQUAL(int(app::State::REFRESHING), int(m.state()));
    TEST_ASSERT_EQUAL(2, panel.begin_count);
    TEST_ASSERT_EQUAL(2 * kTotalBytes, panel.bytes_written);
    TEST_ASSERT_EQUAL(2, panel.start_count);
    TEST_ASSERT_FALSE(m.pending_frame());
}

void test_second_push_during_cooldown_overwrites_pending() {
    reset();
    FakePanel panel;
    auto m = make(panel);

    m.begin_stream();
    m.commit_stream();
    panel.busy = false;
    m.tick();  // -> COOLDOWN

    // First queued push.
    TEST_ASSERT_EQUAL(int(app::RefreshMachine::BeginResult::Ok), int(m.begin_stream()));
    TEST_ASSERT_EQUAL(int(app::RefreshMachine::CommitResult::Queued), int(m.commit_stream()));
    TEST_ASSERT_TRUE(m.pending_frame());

    // Second push starts: replaces pending without rejection.
    TEST_ASSERT_EQUAL(int(app::RefreshMachine::BeginResult::Ok), int(m.begin_stream()));
    TEST_ASSERT_FALSE(m.pending_frame());  // previous READY was stomped
    TEST_ASSERT_EQUAL(int(app::RefreshMachine::CommitResult::Queued), int(m.commit_stream()));
    TEST_ASSERT_TRUE(m.pending_frame());
}

void test_stalled_upload_is_aborted_by_tick() {
    reset();
    FakePanel panel;
    auto m = make(panel);

    m.begin_stream();
    TEST_ASSERT_EQUAL(int(app::State::UPLOADING), int(m.state()));

    g_now += kUploadStaleTimeoutMs + 1;
    m.tick();

    TEST_ASSERT_EQUAL(int(app::State::IDLE), int(m.state()));
    TEST_ASSERT_EQUAL(int(app::RefreshMachine::BeginResult::Ok), int(m.begin_stream()));
}

void test_begin_stream_during_upload_returns_busy() {
    reset();
    FakePanel panel;
    auto m = make(panel);

    TEST_ASSERT_EQUAL(int(app::RefreshMachine::BeginResult::Ok), int(m.begin_stream()));
    auto r = m.begin_stream();
    TEST_ASSERT_EQUAL(int(app::RefreshMachine::BeginResult::Busy), int(r));
}

void test_cooldown_remaining_decreases() {
    reset();
    FakePanel panel;
    auto m = make(panel);

    m.begin_stream();
    m.commit_stream();
    panel.busy = false;
    m.tick();
    const unsigned long start = g_now;

    TEST_ASSERT_EQUAL(kCooldownMs / 1000UL, m.cooldown_remaining_s());

    g_now = start + 60UL * 1000UL;
    TEST_ASSERT_EQUAL((kCooldownMs - 60UL * 1000UL) / 1000UL, m.cooldown_remaining_s());

    g_now = start + kCooldownMs + 1;
    TEST_ASSERT_EQUAL(0UL, m.cooldown_remaining_s());
}

void test_cooldown_expires_to_idle_when_no_pending() {
    reset();
    FakePanel panel;
    auto m = make(panel);

    m.begin_stream();
    m.commit_stream();
    panel.busy = false;
    m.tick();

    g_now += kCooldownMs + 1;
    m.tick();
    TEST_ASSERT_EQUAL(int(app::State::IDLE), int(m.state()));

    auto r = m.begin_stream();
    TEST_ASSERT_EQUAL(int(app::RefreshMachine::BeginResult::Ok), int(r));
}

int main(int /*argc*/, char** /*argv*/) {
    UNITY_BEGIN();
    RUN_TEST(test_idle_does_nothing_on_tick);
    RUN_TEST(test_begin_stream_does_not_touch_panel);
    RUN_TEST(test_commit_drives_bulk_refresh);
    RUN_TEST(test_commit_with_failed_refresh_returns_failed);
    RUN_TEST(test_abort_stream_returns_to_idle_without_panel_io);
    RUN_TEST(test_refreshing_waits_until_panel_idle);
    RUN_TEST(test_refreshing_times_out_if_panel_hangs);
    RUN_TEST(test_push_during_refreshing_is_queued);
    RUN_TEST(test_push_during_cooldown_is_queued);
    RUN_TEST(test_queued_frame_fires_when_cooldown_ends);
    RUN_TEST(test_second_push_during_cooldown_overwrites_pending);
    RUN_TEST(test_stalled_upload_is_aborted_by_tick);
    RUN_TEST(test_begin_stream_during_upload_returns_busy);
    RUN_TEST(test_cooldown_remaining_decreases);
    RUN_TEST(test_cooldown_expires_to_idle_when_no_pending);
    return UNITY_END();
}
