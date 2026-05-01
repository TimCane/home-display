#include "epd_panel.h"

#include "epd.h"

namespace display {

void EpdPanel::begin_frame()                                     { display::begin_frame(); }
void EpdPanel::write_chunk(const uint8_t* data, std::size_t len) { display::write_chunk(data, len); }
void EpdPanel::end_frame()                                       { display::end_frame(); }
void EpdPanel::start_refresh()                                   { display::start_refresh(); }
bool EpdPanel::is_busy()                                         { return display::is_busy(); }
void EpdPanel::sleep()                                           { display::sleep(); }

}  // namespace display
