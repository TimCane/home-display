#pragma once

namespace app { class RefreshMachine; }

namespace persist {

// Loads counter baselines from NVS into the machine at boot.
void load(app::RefreshMachine& machine);

// Polls the machine's counters; if any have advanced since the last write,
// flushes them to NVS. Designed to be called from the main loop — cheap on
// the no-change path (just four integer comparisons).
void sync(const app::RefreshMachine& machine);

}  // namespace persist
