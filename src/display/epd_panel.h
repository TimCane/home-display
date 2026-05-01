#pragma once
#include "../app/panel.h"

namespace display {

// Concrete IPanel adapter wrapping the bare-metal `display::` driver.
class EpdPanel : public app::IPanel {
   public:
    void begin_frame() override;
    void write_chunk(const uint8_t* data, std::size_t len) override;
    void end_frame() override;
    void start_refresh() override;
    bool is_busy() override;
    void sleep() override;
};

}  // namespace display
