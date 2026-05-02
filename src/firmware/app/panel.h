#pragma once
#include <cstddef>
#include <cstdint>

namespace app {

// Hardware-abstraction interface used by RefreshMachine. Production code
// implements this against the panel driver; tests can substitute a fake.
//
// One frame: begin_frame(), one or more write_chunk() calls totalling
// FRAME_BYTES, end_frame(), start_refresh(). is_busy() is polled until the
// refresh completes; sleep() powers the panel down. start_refresh() returns
// false if the panel never asserted BUSY — the refresh did not begin.
struct IPanel {
    virtual ~IPanel() = default;
    virtual void begin_frame() = 0;
    virtual void write_chunk(const uint8_t* data, std::size_t len) = 0;
    virtual void end_frame() = 0;
    virtual bool start_refresh() = 0;
    virtual bool is_busy() = 0;
    virtual void sleep() = 0;
};

}  // namespace app
