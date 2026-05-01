#include "refresh_machine.h"

#include "panel.h"

namespace app {

RefreshMachine::RefreshMachine(IPanel&       panel,
                               Clock         clock,
                               unsigned long cooldown_ms,
                               unsigned long refresh_timeout_ms,
                               unsigned long upload_stale_timeout_ms)
    : panel_(panel),
      clock_(clock),
      cooldown_ms_(cooldown_ms),
      refresh_timeout_ms_(refresh_timeout_ms),
      upload_stale_timeout_ms_(upload_stale_timeout_ms) {}

void RefreshMachine::set_segments(const std::uint8_t* const* segments,
                                  std::size_t                segment_count,
                                  std::size_t                segment_bytes) {
    segments_      = segments;
    segment_count_ = segment_count;
    segment_bytes_ = segment_bytes;
}

void RefreshMachine::set_counter_baseline(unsigned long ok,
                                          unsigned long timeout,
                                          unsigned long not_started,
                                          unsigned long queued) {
    refresh_ok_count_          = ok;
    refresh_timeout_count_     = timeout;
    refresh_not_started_count_ = not_started;
    queued_count_              = queued;
}

State RefreshMachine::state() const {
    switch (panel_state_) {
        case PanelState::IDLE:
            return upload_state_ == UploadState::IN_PROGRESS
                       ? State::UPLOADING
                       : State::IDLE;
        case PanelState::REFRESHING: return State::REFRESHING;
        case PanelState::COOLDOWN:   return State::COOLDOWN;
    }
    return State::IDLE;
}

bool RefreshMachine::pending_frame() const {
    return upload_state_ == UploadState::READY;
}

bool RefreshMachine::busy() const {
    return panel_state_ == PanelState::REFRESHING;
}

unsigned long RefreshMachine::cooldown_remaining_s() const {
    if (panel_state_ != PanelState::COOLDOWN) return 0;
    unsigned long elapsed = clock_() - cooldown_start_ms_;
    if (elapsed >= cooldown_ms_) return 0;
    return (cooldown_ms_ - elapsed) / 1000UL;
}

RefreshMachine::BeginResult RefreshMachine::begin_stream() {
    // Reject only if another upload is mid-stream. A push during READY is
    // allowed: it transitions back through IN_PROGRESS, overwriting the
    // queued frame (latest-wins coalescing per refresh-contract.md).
    if (upload_state_ == UploadState::IN_PROGRESS) return BeginResult::Busy;
    upload_state_      = UploadState::IN_PROGRESS;
    upload_started_ms_ = clock_();
    return BeginResult::Ok;
}

RefreshMachine::CommitResult RefreshMachine::commit_stream() {
    if (upload_state_ != UploadState::IN_PROGRESS) return CommitResult::Failed;

    if (panel_state_ == PanelState::IDLE) {
        if (!drive_panel_()) {
            upload_state_ = UploadState::NONE;
            return CommitResult::Failed;
        }
        upload_state_ = UploadState::NONE;
        return CommitResult::Accepted;
    }

    // Panel is REFRESHING or COOLDOWN — buffer this frame as the pending
    // slot. tick() consumes it when the cooldown ends.
    upload_state_ = UploadState::READY;
    queued_count_++;
    return CommitResult::Queued;
}

void RefreshMachine::abort_stream() {
    if (upload_state_ != UploadState::IN_PROGRESS) return;
    // The aborted upload may have partially overwritten a previously-READY
    // frame; we drop the slot rather than refresh with mixed bytes.
    upload_state_ = UploadState::NONE;
}

bool RefreshMachine::drive_panel_() {
    panel_.begin_frame();
    for (std::size_t i = 0; i < segment_count_; ++i) {
        panel_.write_chunk(segments_[i], segment_bytes_);
    }
    panel_.end_frame();

    if (!panel_.start_refresh()) {
        panel_.sleep();
        last_refresh_status_ = RefreshStatus::NotStarted;
        panel_state_         = PanelState::IDLE;
        refresh_not_started_count_++;
        consecutive_failures_++;
        return false;
    }

    refresh_start_ms_    = clock_();
    last_refresh_status_ = RefreshStatus::Ok;
    panel_state_         = PanelState::REFRESHING;
    return true;
}

void RefreshMachine::tick() {
    const unsigned long now = clock_();

    // Defensive: drop a stalled upload regardless of panel state. The HTTP
    // layer should call abort_stream() via onDisconnect, but we backstop
    // here in case it doesn't (or the client connection silently goes away).
    if (upload_state_ == UploadState::IN_PROGRESS &&
        (now - upload_started_ms_) >= upload_stale_timeout_ms_) {
        upload_state_ = UploadState::NONE;
    }

    switch (panel_state_) {
        case PanelState::IDLE:
            break;

        case PanelState::REFRESHING: {
            const bool timed_out = (now - refresh_start_ms_) >= refresh_timeout_ms_;
            if (!panel_.is_busy() || timed_out) {
                panel_.sleep();
                cooldown_start_ms_     = now;
                last_refresh_uptime_s_ = now / 1000UL;
                last_refresh_status_   = timed_out ? RefreshStatus::Timeout
                                                   : RefreshStatus::Ok;
                panel_state_           = PanelState::COOLDOWN;
                if (timed_out) {
                    refresh_timeout_count_++;
                    consecutive_failures_++;
                } else {
                    refresh_ok_count_++;
                    consecutive_failures_ = 0;
                }
            }
            break;
        }

        case PanelState::COOLDOWN: {
            if ((now - cooldown_start_ms_) < cooldown_ms_) break;

            if (upload_state_ == UploadState::READY) {
                // drive_panel_ sets panel_state_ to REFRESHING on success,
                // or to IDLE on start_refresh failure.
                drive_panel_();
                upload_state_ = UploadState::NONE;
            } else {
                panel_state_ = PanelState::IDLE;
            }
            break;
        }
    }
}

}  // namespace app
