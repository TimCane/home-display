#include "refresh_machine.h"

#include "panel.h"

namespace app {

RefreshMachine::RefreshMachine(IPanel&       panel,
                               Clock         clock,
                               unsigned long cooldown_ms,
                               unsigned long refresh_timeout_ms)
    : panel_(panel),
      clock_(clock),
      cooldown_ms_(cooldown_ms),
      refresh_timeout_ms_(refresh_timeout_ms) {}

unsigned long RefreshMachine::cooldown_remaining_s() const {
    if (state_ != State::COOLDOWN) return 0;
    unsigned long elapsed = clock_() - cooldown_start_ms_;
    if (elapsed >= cooldown_ms_) return 0;
    return (cooldown_ms_ - elapsed) / 1000UL;
}

RefreshMachine::StreamResult RefreshMachine::begin_stream() {
    if (state_ != State::IDLE) return StreamResult::Busy;
    panel_.begin_frame();
    state_ = State::UPLOADING;
    return StreamResult::Ok;
}

bool RefreshMachine::write_stream_chunk(const uint8_t* data, std::size_t len) {
    if (state_ != State::UPLOADING) return false;
    panel_.write_chunk(data, len);
    return true;
}

void RefreshMachine::commit_stream() {
    if (state_ != State::UPLOADING) return;
    panel_.end_frame();
    panel_.start_refresh();
    refresh_start_ms_       = clock_();
    last_refresh_timed_out_ = false;
    state_                  = State::REFRESHING;
}

void RefreshMachine::abort_stream() {
    if (state_ != State::UPLOADING) return;
    panel_.end_frame();
    panel_.sleep();
    state_ = State::IDLE;
}

void RefreshMachine::tick() {
    const unsigned long now = clock_();

    switch (state_) {
        case State::IDLE:
        case State::UPLOADING:
            break;

        case State::REFRESHING: {
            const bool timed_out = (now - refresh_start_ms_) >= refresh_timeout_ms_;
            if (!panel_.is_busy() || timed_out) {
                panel_.sleep();
                cooldown_start_ms_      = now;
                last_refresh_uptime_s_  = now / 1000UL;
                last_refresh_timed_out_ = timed_out;
                state_                  = State::COOLDOWN;
            }
            break;
        }

        case State::COOLDOWN: {
            if ((now - cooldown_start_ms_) >= cooldown_ms_) {
                state_ = State::IDLE;
            }
            break;
        }
    }
}

}  // namespace app
