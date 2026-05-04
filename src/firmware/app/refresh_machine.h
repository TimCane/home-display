#pragma once
#include <cstddef>
#include <cstdint>

namespace app {

struct IPanel;

enum class State { IDLE, UPLOADING, REFRESHING, COOLDOWN };

// How the most recent refresh ended. Surfaced in /status so callers can
// distinguish a slow but healthy panel from one that's wedged.
enum class RefreshStatus {
    None,        // never refreshed since boot
    Ok,          // BUSY dropped, refresh ran, BUSY came back
    Timeout,     // BUSY stayed LOW past refresh_timeout_ms (panel hung)
    NotStarted,  // BUSY never dropped after the refresh command
};

// Pure-logic layer driving the display lifecycle. Has no Arduino or FreeRTOS
// dependencies — accepts time via an injected clock function and delegates all
// I/O to IPanel. Testable on host.
//
// Two orthogonal axes:
//
//   panel_state_   IDLE -> REFRESHING -> COOLDOWN -> IDLE
//   upload_state_  NONE -> IN_PROGRESS -> NONE          (immediate path)
//                  NONE -> IN_PROGRESS -> READY -> NONE (queued path,
//                                                       consumed when the
//                                                       cooldown ends)
//
// Pushes during REFRESHING/COOLDOWN are accepted into a single "pending" slot
// (segments are reused — the panel has already consumed them by then). The
// docs call this latest-wins coalescing: a second push while READY simply
// overwrites the first by transitioning back through IN_PROGRESS.
//
// Public state() compresses these axes onto the original 4-state enum so the
// /status response stays compatible.
class RefreshMachine {
   public:
    using Clock = unsigned long (*)();

    enum class BeginResult  { Ok, Busy };
    enum class CommitResult { Accepted, Queued, Failed };

    RefreshMachine(IPanel&        panel,
                   Clock          clock,
                   unsigned long  cooldown_ms,
                   unsigned long  refresh_timeout_ms,
                   unsigned long  upload_stale_timeout_ms);

    // Set once at boot after the framebuffer segments are allocated. tick()
    // needs them so it can fire a queued refresh when the cooldown ends.
    void set_segments(const std::uint8_t* const* segments,
                      std::size_t                segment_count,
                      std::size_t                segment_bytes);

    BeginResult  begin_stream();
    CommitResult commit_stream();
    void         abort_stream();

    void tick();

    State         state() const;
    bool          pending_frame() const;
    bool          busy() const;
    unsigned long last_refresh_uptime_s() const  { return last_refresh_uptime_s_; }
    unsigned long cooldown_remaining_s() const;
    RefreshStatus last_refresh_status() const    { return last_refresh_status_; }

    // Cumulative counters since boot (or since NVS-loaded baseline). The
    // "ok" counter increments on a refresh that completed without timing
    // out; the failure counters bucket the two failure modes; queued
    // increments each time a push lands in the pending slot (regardless of
    // whether it ultimately fired or was overwritten); consecutive_failures
    // resets to 0 on each Ok refresh.
    unsigned long refresh_ok_count() const         { return refresh_ok_count_; }
    unsigned long refresh_timeout_count() const    { return refresh_timeout_count_; }
    unsigned long refresh_not_started_count() const{ return refresh_not_started_count_; }
    unsigned long queued_count() const             { return queued_count_; }
    unsigned long consecutive_failures() const     { return consecutive_failures_; }
    void          set_counter_baseline(unsigned long ok,
                                       unsigned long timeout,
                                       unsigned long not_started,
                                       unsigned long queued);

   private:
    enum class PanelState  { IDLE, REFRESHING, COOLDOWN };
    enum class UploadState { NONE, IN_PROGRESS, READY };

    bool drive_panel_();

    IPanel&             panel_;
    Clock               clock_;
    const unsigned long cooldown_ms_;
    const unsigned long refresh_timeout_ms_;
    const unsigned long upload_stale_timeout_ms_;

    const std::uint8_t* const* segments_      = nullptr;
    std::size_t                segment_count_ = 0;
    std::size_t                segment_bytes_ = 0;

    PanelState    panel_state_           = PanelState::IDLE;
    UploadState   upload_state_          = UploadState::NONE;
    unsigned long upload_started_ms_     = 0;
    unsigned long refresh_start_ms_      = 0;
    unsigned long cooldown_start_ms_     = 0;
    unsigned long last_refresh_uptime_s_ = 0;
    RefreshStatus last_refresh_status_   = RefreshStatus::None;

    unsigned long refresh_ok_count_           = 0;
    unsigned long refresh_timeout_count_      = 0;
    unsigned long refresh_not_started_count_  = 0;
    unsigned long queued_count_               = 0;
    unsigned long consecutive_failures_       = 0;
};

}  // namespace app
