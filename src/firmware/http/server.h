#pragma once
#include <cstddef>
#include <cstdint>

namespace app {
class RefreshMachine;
}

namespace http {

// Wires up POST /fb and GET /status against the supplied state machine,
// then starts the underlying AsyncWebServer. The /fb body is buffered into
// `segments` (each holding `segment_bytes`, totalling segment_count * segment_bytes)
// before being bulk-streamed to the panel — keeping the SSD2677 data session
// continuous despite network jitter. The segmented layout exists because no
// single contiguous DRAM block large enough for the full frame is available.
void start(app::RefreshMachine& machine,
           std::uint8_t* const*  segments,
           std::size_t           segment_count,
           std::size_t           segment_bytes);

}  // namespace http
