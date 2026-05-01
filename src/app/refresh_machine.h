#pragma once
#include <cstddef>
#include <cstdint>

namespace app {

struct IPanel;

enum class State { IDLE, UPLOADING, REFRESHING, COOLDOWN };

// Pure-logic layer driving the display lifecycle. Has no Arduino or FreeRTOS
// dependencies — accepts time via an injected clock function and delegates all
// I/O to IPanel. Testable on host.
//
// HTTP uploads stream straight to the panel: there is no framebuffer.
//   begin_stream()  -> opens the panel data window (UPLOADING)
//   write_stream_chunk(data, len) -> pushes bytes through the open window
//   commit_stream() -> closes the window and triggers refresh (REFRESHING)
//   abort_stream()  -> closes the window without refreshing (back to IDLE)
//
// tick() polls the panel during REFRESHING and drives the COOLDOWN -> IDLE
// transition. Uploads outside IDLE return Busy.
class RefreshMachine {
   public:
    using Clock = unsigned long (*)();

    enum class StreamResult { Ok, Busy };

    RefreshMachine(IPanel&        panel,
                   Clock          clock,
                   unsigned long  cooldown_ms,
                   unsigned long  refresh_timeout_ms);

    StreamResult begin_stream();
    bool         write_stream_chunk(const uint8_t* data, std::size_t len);
    void         commit_stream();
    void         abort_stream();

    void tick();

    State         state() const                  { return state_; }
    unsigned long last_refresh_uptime_s() const  { return last_refresh_uptime_s_; }
    unsigned long cooldown_remaining_s() const;
    bool          last_refresh_timed_out() const { return last_refresh_timed_out_; }

   private:
    IPanel&             panel_;
    Clock               clock_;
    const unsigned long cooldown_ms_;
    const unsigned long refresh_timeout_ms_;

    State         state_                  = State::IDLE;
    unsigned long refresh_start_ms_       = 0;
    unsigned long cooldown_start_ms_      = 0;
    unsigned long last_refresh_uptime_s_  = 0;
    bool          last_refresh_timed_out_ = false;
};

}  // namespace app
