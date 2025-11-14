import React, { useState, useEffect, useRef } from "react";
import ConfirmModal from "../ConfirmModal";
import { createTracker } from "../../services/trackerService";
import { createDeviceToken } from "../../services/deviceTokenService";
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { useMunicipalities } from "../../hooks/useMunicipalities";

const COASTAL_ONLY = true;

const AddTrackerModal = ({ isOpen, onClose, onCreated }) => {
  const [formData, setFormData] = useState({
    BirukBilugID: "",
    municipality: "",
    status: "available",
  });
  const [error, setError] = useState(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState({ open: false, message: "" });
  const [provision, setProvision] = useState({ open: false, token: "", boatId: null, trackerId: "" });
  const { municipalities } = useMunicipalities();

  // Web Serial state
  const serialSupported = typeof navigator !== "undefined" && "serial" in navigator;
  const [serial, setSerial] = useState({ port: null, connected: false, connecting: false, logs: "", error: null });
  const [provState, setProvState] = useState({ status: "idle", message: "", success: false }); // idle|connecting|provisioning|success|error
  const [copied, setCopied] = useState(false);
  const [grantedPorts, setGrantedPorts] = useState([]);
  const [selectedPortIndex, setSelectedPortIndex] = useState(-1);
  const readerRef = useRef(null);
  const portRef = useRef(null);
  const logBaselineRef = useRef(0);
  const logsRef = useRef("");

  // Ensure hooks order remains stable across renders
  useEffect(() => {
    return () => {
      try { if (readerRef.current) { readerRef.current.cancel().catch(() => {}); } } catch {}
      try { if (portRef.current) { portRef.current.close().catch(() => {}); } } catch {}
    };
  }, []);

  // When opening provisioning, list previously granted ports
  useEffect(() => {
    if (!provision.open || !serialSupported) return;
    (async () => {
      try {
        const ports = await navigator.serial.getPorts();
        setGrantedPorts(ports);
        if (ports.length && selectedPortIndex < 0) setSelectedPortIndex(0);
      } catch {}
    })();
  }, [provision.open, serialSupported]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitModalOpen(true);
  };

  const handleConfirmSubmit = async () => {
    try {
      const payload = {
        municipality: formData.municipality,
        status: formData.status,
      };

      const created = await createTracker(payload);
      const fullId = created?.BirukBilugID;

      const tokenRes = await createDeviceToken({ name: fullId });

      setIsSubmitModalOpen(false);
      setProvision({ open: true, token: tokenRes.token, boatId: tokenRes.boat_id ?? null, trackerId: fullId });
      // Do not show success yet; wait for provisioning success or user finish.

    } catch (err) {
      let errorMessage = "An error occurred while submitting the form.";

      if (err.response?.data) {
        if (err.response.data.BirukBilugID) {
          errorMessage = `BirukBilug ID Error: ${err.response.data.BirukBilugID[0]}`;
        } else if (err.response.data.municipality) {
          errorMessage = `Municipality Error: ${err.response.data.municipality[0]}`;
        } else if (err.response.data.message) {
          errorMessage = err.response.data.message;
        } else if (typeof err.response.data === "object") {
          const firstError = Object.values(err.response.data)[0];
          if (Array.isArray(firstError)) {
            errorMessage = firstError[0];
          } else {
            errorMessage = firstError;
          }
        }
      }

      setError(errorMessage);
      setIsSubmitModalOpen(false);
      setShowErrorModal({ open: true, message: errorMessage });
    }
  };

  // --- Web Serial helpers ---
  const appendLog = (s) => setSerial((prev) => ({ ...prev, logs: (prev.logs + s).slice(-8000) }));

  // keep a ref of latest logs for polling without stale closures
  useEffect(() => { logsRef.current = serial.logs; }, [serial.logs]);

  const startReadLoop = async (port) => {
    try {
      const decoder = new TextDecoderStream();
      const readableStreamClosed = port.readable.pipeTo(decoder.writable);
      const reader = decoder.readable.getReader();
      readerRef.current = reader;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) appendLog(value);
      }
      await readableStreamClosed.catch(() => {});
    } catch (_) {
      // ignore
    }
  };

  const openPort = async (givenPort = null) => {
    setSerial((s) => ({ ...s, connecting: true, error: null }));
    try {
      setProvState({ status: "connecting", message: "Opening serial device...", success: false });
      let port = givenPort || portRef.current || serial.port;

      // Prefer a selected already-granted port
      if (!port && grantedPorts.length && selectedPortIndex >= 0) {
        port = grantedPorts[selectedPortIndex];
      }

      // If the chosen port is already open in this tab, just mark connected
      if (port && port.readable) {
        portRef.current = port;
        setSerial({ port, connected: true, connecting: false, logs: serial.logs, error: null });
        setProvState({ status: "idle", message: "", success: false });
        if (!readerRef.current) void startReadLoop(port);
        return port;
      }

      if (!port) {
        port = await navigator.serial.requestPort({
          filters: [
            { usbVendorId: 0x10c4 }, // Silicon Labs CP210x
            { usbVendorId: 0x1a86 }, // WCH CH34x
            { usbVendorId: 0x0403 }, // FTDI
            { usbVendorId: 0x303a }, // Espressif
          ],
        });
      }

      await port.open({ baudRate: 115200 });
      portRef.current = port;
      setSerial({ port, connected: true, connecting: false, logs: "", error: null });
      setProvState({ status: "idle", message: "", success: false });
      void startReadLoop(port);
      return port;
    } catch (e) {
      let msg = e?.message || (e?.name === "NotFoundError" ? "No port selected" : "Failed to open serial port");
      // If port is reported as already open, reuse it if possible
      if (msg?.toLowerCase().includes("already open")) {
        try {
          const ports = await navigator.serial.getPorts();
          const open = ports.find((p) => p.readable);
          if (open) {
            portRef.current = open;
            setSerial({ port: open, connected: true, connecting: false, logs: serial.logs, error: null });
            setProvState({ status: "idle", message: "", success: false });
            if (!readerRef.current) void startReadLoop(open);
            return open;
          }
        } catch (_) {}
      }
      setSerial((s) => ({ ...s, connecting: false, error: `${msg}. Close any other serial monitor (Arduino/PlatformIO) and try again.` }));
      setProvState({ status: "error", message: msg, success: false });
      setShowErrorModal({ open: true, message: msg });
      return null;
    }
  };

  const grantNewPort = async () => {
    try {
      const p = await navigator.serial.requestPort({
        filters: [
          { usbVendorId: 0x10c4 },
          { usbVendorId: 0x1a86 },
          { usbVendorId: 0x0403 },
          { usbVendorId: 0x303a },
        ],
      });
      const ports = await navigator.serial.getPorts();
      setGrantedPorts(ports);
      const idx = ports.findIndex((x) => x === p);
      setSelectedPortIndex(idx >= 0 ? idx : ports.length - 1);
      return p;
    } catch (e) {
      // user canceled
      return null;
    }
  };

  const writeLine = async (port, line) => {
    const encoder = new TextEncoder();
    const writer = port.writable.getWriter();
    await writer.write(encoder.encode(line + "\n"));
    writer.releaseLock();
  };

  const closePort = async () => {
    try {
      if (readerRef.current) {
        await readerRef.current.cancel().catch(() => {});
        readerRef.current = null;
      }
      const p = portRef.current || serial.port;
      if (p) await p.close();
    } catch (_) {}
    setSerial({ port: null, connected: false, connecting: false, logs: "", error: null });
  };

  const waitForRegex = async (regex, timeoutMs = 3000) => {
    const start = Date.now();
    const baseLen = logsRef.current.length;
    while (Date.now() - start < timeoutMs) {
      const full = logsRef.current;
      const recent = full.slice(baseLen);
      if (regex.test(recent) || regex.test(full)) return true; // search recent and full for robustness
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  };

  const connectAndProvision = async (token, trackerId) => {
    if (!serialSupported) return;
    const port = serial.port || (await openPort());
    if (!port) return;
    // Clear logs and reset baseline to avoid false positives from old data
    setSerial(s => ({ ...s, logs: "" }));
    logsRef.current = "";
    logBaselineRef.current = 0;
    setProvState({ status: "provisioning", message: "Waiting for device to boot...", success: false });
    appendLog("[PROVISION] Waiting for ESP32 to boot...\n");

    try {
      // Wait for either:
      // 1. "Waiting for provisioning commands..." (device needs provisioning)
      // 2. "Device provisioned successfully!" (device already provisioned)
      const bootMessage = await Promise.race([
        waitForRegex(/Waiting for provisioning commands/i, 10000).then(found => found ? 'needs_provision' : null),
        waitForRegex(/Device provisioned successfully/i, 10000).then(found => found ? 'already_provisioned' : null)
      ]);
      
      if (!bootMessage) {
        setProvState({ status: "error", message: "ESP32 did not finish booting. Try resetting the device.", success: false });
        setShowErrorModal({ open: true, message: "ESP32 boot timeout. Press the reset button on the device and try again." });
        return;
      }
      
      // If device is already provisioned, check if it matches this tracker
      if (bootMessage === 'already_provisioned') {
        appendLog("[PROVISION] Device is already provisioned. Verifying...\n");
        setProvState({ status: "provisioning", message: "Device already provisioned. Verifying...", success: false });
        
        // Send INFO to check device ID
        await new Promise(r => setTimeout(r, 1000));
        await writeLine(port, `INFO`);
        await new Promise(r => setTimeout(r, 1000));
        
        // Check if the provisioned device ID matches our tracker ID
        const deviceIdMatch = await waitForRegex(new RegExp(`device_id=${trackerId}`, 'i'), 3000);
        
        if (deviceIdMatch) {
          setProvState({ status: "success", message: "Device is already provisioned with correct ID!", success: true });
          appendLog("[PROVISION] Device already configured correctly.\n");
        } else {
          setProvState({ status: "error", message: "Device is provisioned with different ID. Send RESET command first.", success: false });
          setShowErrorModal({ open: true, message: "This device is already provisioned with a different tracker ID. Send 'RESET' command in serial monitor to erase, then try again." });
        }
        return;
      }
      
      // Device needs provisioning - proceed with normal flow
      appendLog("[PROVISION] Device ready. Sending credentials...\n");
      setProvState({ status: "provisioning", message: "Sending credentials...", success: false });
      
      // Small delay to ensure ESP32 is ready to receive
      await new Promise(r => setTimeout(r, 500));
      
      // Send simplified provisioning commands (ESP32 auto-uses defaults for host/port/path)
      await writeLine(port, `DEVICE_ID=${trackerId}`);
      await new Promise(r => setTimeout(r, 300));
      await writeLine(port, `TOKEN=${token}`);
      await new Promise(r => setTimeout(r, 300));
      await writeLine(port, `PROVISION`);
      await new Promise(r => setTimeout(r, 500));
      appendLog("[PROVISION] DEVICE_ID/TOKEN/PROVISION sent.\n");

      // Look for successful provisioning confirmation
      const success = await waitForRegex(/(Credentials stored successfully|Configuration saved successfully)/i, 8000);
      if (!success) {
        // Try INFO command to check if provisioning worked
        await writeLine(port, `INFO`);
        const confirmed = await waitForRegex(/(provisioned=yes|PROVISIONED=yes)/i, 4000);
        if (!confirmed) {
          setProvState({ status: "error", message: "Device did not confirm provisioning. Check serial log.", success: false });
          setShowErrorModal({ open: true, message: "Provisioning failed. Ensure ESP32 is running updated firmware and try again." });
          return;
        }
      }
      setProvState({ status: "success", message: "Provisioning successful! Device configured.", success: true });
    } catch (e) {
      const msg = e?.message || "Failed to write to serial";
      setSerial((s) => ({ ...s, error: msg }));
      setProvState({ status: "error", message: msg, success: false });
      setShowErrorModal({ open: true, message: msg });
      return;
    }
  };

  // Detect successful provisioning/reboot from recent logs
  useEffect(() => {
    if (provState.status !== "provisioning") return;
    const recent = serial.logs.slice(logBaselineRef.current);
    if (/Stored token.*Rebooting/i.test(recent) || /rst:0x[0-9a-f]+/i.test(recent) || recent.includes("ESP32 Tracker boot")) {
      setProvState({ status: "success", message: "Device rebooted after provisioning.", success: true });
    }
  }, [serial.logs, provState.status]);

  // When provisioning succeeds, show success modal but keep provision dialog until user clicks Finish
  useEffect(() => {
    if (provState.success && provision.open) {
      setShowSuccessModal(true);
    }
  }, [provState.success]);

  // Auto-close serial port when the provision dialog is closed
  useEffect(() => {
    if (!provision.open && (serial.connected || portRef.current)) {
      void closePort();
    }
  }, [provision.open]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Add Tracker</h2>
          <button onClick={() => { void closePort(); onClose(); }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 text-red-700 bg-red-100 rounded-lg text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="px-6 py-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Municipality <span className="text-red-500">*</span>
            </label>
            <Listbox
              value={formData.municipality}
              onChange={(val) => {
                setFormData((prev) => ({
                  ...prev,
                  municipality: val,
                  BirukBilugID: "",
                }));
              }}
            >
              <div className="relative mt-1">
                <Listbox.Button
                  required
                  className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-500"
                >
                  <span className="block truncate">
                    {formData.municipality || "Select municipality"}
                  </span>
                  <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                  </span>
                </Listbox.Button>
                <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  {(municipalities || [])
                    .filter((m) => (COASTAL_ONLY ? m.is_coastal : true))
                    .map((m) => (
                      <Listbox.Option
                        key={m.municipality_id}
                        value={m.name}
                        className={({ active }) =>
                          `relative cursor-default select-none py-2 pl-10 pr-4 ${
                            active ? "bg-blue-100 text-blue-900" : "text-gray-900"
                          }`
                        }
                      >
                        {m.name}
                      </Listbox.Option>
                    ))}
                </Listbox.Options>
              </div>
            </Listbox>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">BirukBilug ID</label>
            <div className="flex items-center mt-1">
              <span className="px-3 py-2 bg-blue-600 border border-gray-300 rounded-l-lg text-white font-mono">
                {(() => {
                  const m = (municipalities || []).find((x) => x.name === formData.municipality);
                  return m && m.prefix ? m.prefix : "XXX";
                })()}
              </span>
              <div className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 bg-gray-50 text-gray-500">
                Will be generated automatically on submit
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
            >
              Add Tracker
            </button>
          </div>
        </form>

        {/* Submit Confirmation Modal */}
        <ConfirmModal
          isOpen={isSubmitModalOpen}
          onClose={() => setIsSubmitModalOpen(false)}
          onConfirm={handleConfirmSubmit}
          title="Register Tracker"
          message="Are you sure you want to register this tracker?"
        />

        {/* Success Modal - only show during provisioning flow */}
        {showSuccessModal && provision.open && (
          <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg className="h-8 w-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Provisioning Successful</h3>
              <p className="text-sm text-gray-600 mb-5">Device configured. Review the serial log and click Finish.</p>
              <button
                className="w-full px-4 py-2 text-sm font-medium text-white bg-[#4F46E5] hover:bg-[#4338CA] rounded-md"
                onClick={() => {
                  setShowSuccessModal(false);
                }}
              >
                OK
              </button>
            </div>
          </div>
        )}

        {/* Error Modal */}
        {showErrorModal.open && (
          <div className="fixed inset-0 z-[11060] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-8 w-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Failed</h3>
              <p className="text-sm text-gray-600 mb-5">{showErrorModal.message || "An error occurred."}</p>
              <button
                className="w-full px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
                onClick={() => setShowErrorModal({ open: false, message: "" })}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {provision.open && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl overflow-hidden">
              <div className="px-6 pt-6 pb-4">
                <h2 className="text-lg font-semibold text-gray-900">Provision Device</h2>
                {!serialSupported && (
                  <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md p-3 mt-3">
                    Your browser does not support Web Serial. Use the commands below in your serial monitor.
                  </p>
                )}
              </div>

              {/* Web Serial Provisioning */}
              {serialSupported && (
                <div className="px-6 pb-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      Status: {provState.status === "connecting" ? "Connecting..." : serial.connected ? (provState.status === "provisioning" ? "Provisioning..." : "Connected") : "Disconnected"}
                    </div>
                    <div className="flex gap-2">
                      {!serial.connected ? (
                        <button
                          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                          onClick={() => void connectAndProvision(provision.token, provision.trackerId)}
                        >
                          {provState.status === "connecting" ? "Connecting..." : "Provision"}
                        </button>
                      ) : (
                        <button
                          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                          onClick={() => void closePort()}
                        >
                          Disconnect
                        </button>
                      )}
                      {/* When connected, provisioning will start automatically. No extra button. */}
                    </div>
                  </div>

                  {/* Custom port picker modal-like section */}
                  <div className="mt-3 rounded-md border border-gray-200 p-3">
                    <div className="text-sm font-medium text-gray-700 mb-2">Select serial device</div>
                    {grantedPorts.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <select
                          className="flex-1 border border-gray-300 rounded-md px-2 py-2 text-sm"
                          value={selectedPortIndex}
                          onChange={(e) => setSelectedPortIndex(parseInt(e.target.value, 10))}
                        >
                          {grantedPorts.map((p, i) => {
                            const info = p.getInfo ? p.getInfo() : {};
                            const vid = info.usbVendorId ? info.usbVendorId.toString(16).padStart(4, "0") : "????";
                            const pid = info.usbProductId ? info.usbProductId.toString(16).padStart(4, "0") : "????";
                            return (
                              <option key={i} value={i}>{`USB VID:PID ${vid}:${pid} (paired)`}</option>
                            );
                          })}
                        </select>
                        {/* Single-button flow: use Provision above; this picker only selects the target port */}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600">No paired devices yet. Click “Grant access” to select a port.</div>
                    )}
                    <div className="mt-2">
                      <button
                        className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                        onClick={() => void grantNewPort()}
                      >
                        Grant access to a new port
                      </button>
                    </div>
                  </div>

                  {serial.error && (
                    <div className="text-sm text-red-700 bg-red-100 border border-red-200 rounded-md p-2">{serial.error}</div>
                  )}
                  {provState.status === "success" && (
                    <div className="text-sm text-green-700 bg-green-100 border border-green-200 rounded-md p-2">Provision successful. Device reboot detected.</div>
                  )}
                  {provState.status === "error" && (
                    <div className="text-sm text-red-700 bg-red-100 border border-red-200 rounded-md p-2">{provState.message}</div>
                  )}
                  <div className="h-40 overflow-auto rounded-md border border-gray-200 bg-gray-50 p-2 font-mono text-xs whitespace-pre-wrap">
                    {serial.logs || "Serial log will appear here..."}
                  </div>
                </div>
              )}

              {/* Manual fallback */}
              {!serialSupported && (
                <div className="px-6 pb-4">
                  <p className="text-sm text-gray-600 mt-2">Send these commands one by one in ESP32 Serial Monitor (115200 baud):</p>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm font-mono space-y-2 overflow-x-auto">
                    <div className="text-gray-800">DEVICE_ID={provision.trackerId}</div>
                    <div className="text-gray-800 break-all">TOKEN={provision.token}</div>
                    <div className="text-gray-800">PROVISION</div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Host defaults to: unskilfully-unsoftening-flynn.ngrok-free.dev</p>
                </div>
              )}

              <div className="flex justify-end gap-3 px-6 pb-6">
                <button
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  onClick={async () => {
                    await closePort();
                    setProvision({ open: false, token: "", boatId: null, trackerId: "" });
                    // Refresh list and close parent modal
                    if (onCreated) onCreated();
                    if (onClose) onClose();
                  }}
                >
                  {provState.success ? "Finish" : "Finish without provisioning"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddTrackerModal;
