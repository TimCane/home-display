#include "counters.h"

#include <Preferences.h>

#include "../app/refresh_machine.h"

namespace persist {
namespace {

constexpr const char* kNamespace = "epd";
constexpr const char* kKeyOk     = "rok";
constexpr const char* kKeyTo     = "rto";
constexpr const char* kKeyNs     = "rns";
constexpr const char* kKeyQ      = "rq";

// Held open for the device's lifetime so we don't repeatedly mount/unmount
// NVS on every loop iteration. Preferences::end() is only called at process
// teardown — which on this firmware is never.
Preferences   g_prefs;
bool          g_open    = false;
bool          g_loaded  = false;
unsigned long g_last_ok = 0;
unsigned long g_last_to = 0;
unsigned long g_last_ns = 0;
unsigned long g_last_q  = 0;

}  // namespace

void load(app::RefreshMachine& machine) {
    g_open    = g_prefs.begin(kNamespace, /*readOnly*/ false);
    g_loaded  = true;
    if (!g_open) {
        // First boot before NVS is initialised — counters stay at zero and
        // sync() will keep no-ops until a successful begin happens. We don't
        // retry here; if NVS is broken, counters are simply non-persistent.
        return;
    }
    const unsigned long ok = g_prefs.getULong(kKeyOk, 0);
    const unsigned long to = g_prefs.getULong(kKeyTo, 0);
    const unsigned long ns = g_prefs.getULong(kKeyNs, 0);
    const unsigned long q  = g_prefs.getULong(kKeyQ,  0);

    machine.set_counter_baseline(ok, to, ns, q);
    g_last_ok = ok;
    g_last_to = to;
    g_last_ns = ns;
    g_last_q  = q;
}

void sync(const app::RefreshMachine& machine) {
    if (!g_loaded || !g_open) return;
    const unsigned long ok = machine.refresh_ok_count();
    const unsigned long to = machine.refresh_timeout_count();
    const unsigned long ns = machine.refresh_not_started_count();
    const unsigned long q  = machine.queued_count();
    if (ok == g_last_ok && to == g_last_to && ns == g_last_ns && q == g_last_q) {
        return;
    }

    if (ok != g_last_ok) g_prefs.putULong(kKeyOk, ok);
    if (to != g_last_to) g_prefs.putULong(kKeyTo, to);
    if (ns != g_last_ns) g_prefs.putULong(kKeyNs, ns);
    if (q  != g_last_q)  g_prefs.putULong(kKeyQ,  q);

    g_last_ok = ok;
    g_last_to = to;
    g_last_ns = ns;
    g_last_q  = q;
}

}  // namespace persist
