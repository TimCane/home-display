#pragma once
#include <cstddef>
#include <cstdint>

namespace app {

// Hardware-abstraction interface used by RefreshMachine. Production code
// implements this against the panel driver; tests can substitute a fake.
//
// Frames are streamed: callers issue begin_frame(), one or more write_chunk()
// calls totalling FRAME_BYTES, then end_frame(). start_refresh() then triggers
// the actual panel update; is_busy() is polled until it returns false; sleep()
// powers the panel down.
struct IPanel {
    virtual ~IPanel() = default;
    virtual void begin_frame() = 0;
    virtual void write_chunk(const uint8_t* data, std::size_t len) = 0;
    virtual void end_frame() = 0;
    virtual void start_refresh() = 0;
    virtual bool is_busy() = 0;
    virtual void sleep() = 0;
};

}  // namespace app
