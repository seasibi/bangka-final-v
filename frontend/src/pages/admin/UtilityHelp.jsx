import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { FaChevronLeft } from 'react-icons/fa'

const AccordionItem = ({ title, children, isOpen, onToggle }) => (
  <div className="border border-gray-200 rounded mb-2">
    <button
      onClick={onToggle}
      className="w-full text-left px-4 py-3 bg-gray-50 flex justify-between items-center"
    >
      <span className="font-medium">{title}</span>
      <span className="text-gray-500">{isOpen ? '−' : '+'}</span>
    </button>
    {isOpen && <div className="p-4 text-gray-700">{children}</div>}
  </div>
)

const UtilityHelp = () => {
  const navigate = useNavigate()
  const [open, setOpen] = useState({
    imports: false,
    municipal: false,
    barangayVerifier: false,
    signatories: false,
    boundary: false,
    activityLogs: false,
    backup: false,
    helpCenter: false,
  })

  return (
    <div className="min-h-screen bg-gray-50 p-2">
      <div className="h-full bg-gray-50 px-4 py-6 pb-16">
        <div className="flex items-center mb-3 mt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-all duration-200"
          >
            <FaChevronLeft className="w-5 h-5" />
          </button>

          <div className="grid grid-cols-1 grid-rows-2 ml-4">
            <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Utility
            </h1>
            <p className="text-base text-gray-700" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Utilities for Import, Municipal Management, Barangay Verifier Management, Signatories, Boundary Editor, Activity Logs, Backup & Restore, and Help Center.
            </p>
          </div>
        </div>

      <AccordionItem
        title="Imports"
        isOpen={open.imports}
        onToggle={() => setOpen((s) => ({ ...s, imports: !s.imports }))}
      >
        <ol className="list-decimal space-y-1">
          <li className="ml-5">Open Utility → <strong>Import Excel</strong>.</li>
          <li className="ml-5">Select import type using the radio buttons: <strong>Import Boats</strong> or <strong>Import Fisherfolk</strong>.</li>
          <li className="ml-5">Click <strong>Choose File</strong> and select your <strong>.xlsx</strong> or <strong>.xls</strong> file.</li>
          <li className="ml-5">Verify the selected filename appears under the input (✓ Selected: filename).</li>
          <li className="ml-5">Click <strong>Upload & Import</strong>. A <strong>Confirm Import</strong> modal will appear.</li>
          <li className="ml-5">In the modal, click <strong>Confirm</strong> to proceed.</li>
          <li className="ml-5">Wait for processing. On success, a <strong>Success</strong> modal shows the count of imported records.</li>
          <li className="ml-5">If there are row issues, review the <strong>Some rows had errors</strong> list and fix your Excel accordingly.</li>
        </ol>
        <div className="mt-2"><Link to="/admin/help/imports" className="text-blue-600 underline">Open detailed Imports help</Link></div>
      </AccordionItem>

      <AccordionItem
        title="Municipal Management"
        isOpen={open.municipal}
        onToggle={() => setOpen((s) => ({ ...s, municipal: !s.municipal }))}
      >
        <ol className="list-decimal space-y-1">
          <li className="ml-5">Open Utility → <strong>Municipal Management</strong>.</li>
          <li className="ml-5">Use the tabs <strong>ADD MUNICIPALITY</strong> and <strong>EDIT MUNICIPALITY</strong> to switch modes.</li>
          <li className="ml-5">In Add tab: fill <strong>Municipality Name</strong>, choose <strong>Map Identifier Icon</strong> (Circle/Triangle), and set <strong>Municipality Color</strong>.</li>
          <li className="ml-5">Add barangays: enter a name, click the <strong>+</strong> button. Remove using the <strong>×</strong> button. Confirm via modal prompts.</li>
          <li className="ml-5">Click <strong>Add Municipality</strong> and confirm. A success modal will appear.</li>
          <li className="ml-5">In Edit tab: select a municipality from the right list, adjust fields, toggle <strong>Municipality Status</strong> if needed.</li>
          <li className="ml-5">Manage barangays in Edit: add via <strong>+</strong>, remove via <strong>×</strong> (delete prompts appear when removing existing items).</li>
          <li className="ml-5">Click <strong>Update Municipality</strong> to save changes, or <strong>Cancel</strong> to revert (with confirmation).</li>
        </ol>
      </AccordionItem>

      <AccordionItem
        title="Barangay Verifier Management"
        isOpen={open.barangayVerifier}
        onToggle={() => setOpen((s) => ({ ...s, barangayVerifier: !s.barangayVerifier }))}
      >
        <ol className="list-decimal space-y-1">
          <li className="ml-5">Go to Utility → <strong>Barangay Verifier Management</strong>.</li>
          <li className="ml-5">Use tabs to switch between <strong>ADD VERIFIER</strong> and <strong>EDIT VERIFIER</strong>.</li>
          <li className="ml-5">Add: choose <strong>Select Position</strong>, then pick <strong>Municipality</strong> and <strong>Barangay</strong>.</li>
          <li className="ml-5">Enter <strong>First Name</strong>, <strong>Middle Name</strong> (optional), and <strong>Last Name</strong>.</li>
          <li className="ml-5">Click <strong>ADD</strong>. Confirm in the modal. A success message will appear.</li>
          <li className="ml-5">Edit: select a verifier from the right list. Update names or toggle <strong>Verifier Status</strong>.</li>
          <li className="ml-5">Click <strong>Update Verifier</strong> to save, or <strong>Cancel</strong> to discard with confirmation.</li>
        </ol>
      </AccordionItem>

      <AccordionItem
        title="Signatories Management"
        isOpen={open.signatories}
        onToggle={() => setOpen((s) => ({ ...s, signatories: !s.signatories }))}
      >
        <ol className="list-decimal space-y-1">
          <li className="ml-5">Open Utility → <strong>Signatories Management</strong>.</li>
          <li className="ml-5">Add tab: choose <strong>Select Position</strong> (e.g., Provincial Agriculturist, Municipal Agriculturist, Municipal Fishery Coordinator, Mayor).</li>
          <li className="ml-5">If position is municipal/barangay scoped, select <strong>Municipality</strong> (and <strong>Barangay</strong> when required).</li>
          <li className="ml-5">Enter <strong>First Name</strong>, <strong>Middle Initial</strong> (1 char), and <strong>Last Name</strong>.</li>
          <li className="ml-5">Click <strong>ADD</strong> and confirm in the modal. Success message appears.</li>
          <li className="ml-5">Edit tab: select a signatory from the right list. Update names or toggle <strong>Signatory Status</strong>.</li>
          <li className="ml-5">Click <strong>Update Signatory</strong> to save, or <strong>Cancel</strong> to revert with confirmation.</li>
        </ol>
      </AccordionItem>

      <AccordionItem
        title="Boundary Editor"
        isOpen={open.boundary}
        onToggle={() => setOpen((s) => ({ ...s, boundary: !s.boundary }))}
      >
        <ol className="list-decimal space-y-1">
          <li className="ml-5">Open Utility → <strong>Boundary Editor</strong>.</li>
          <li className="ml-5">Select a municipality boundary from the list or map.</li>
          <li className="ml-5">Switch modes as needed (e.g., edit water area) and adjust vertices/coordinates.</li>
          <li className="ml-5">Use available actions to <strong>Add</strong> or <strong>Edit</strong> boundaries; confirm when prompted.</li>
          <li className="ml-5">Click <strong>Save</strong>. Wait for the success indicator and verify on the map.</li>
        </ol>
        <div className="mt-2"><Link to="/admin/help/boundary-editor" className="text-blue-600 underline">Open detailed Boundary Editor help</Link></div>
      </AccordionItem>

      <AccordionItem
        title="Activity Logs"
        isOpen={open.activityLogs}
        onToggle={() => setOpen((s) => ({ ...s, activityLogs: !s.activityLogs }))}
      >
        <ol className="list-decimal space-y-1">
          <li className="ml-5">Go to Utility → <strong>Activity Logs</strong>.</li>
          <li className="ml-5">Use any on-screen filters to refine by date/type if available, or switch pages using pagination controls.</li>
          <li className="ml-5">Open entries to view details and use them to audit changes and events.</li>
        </ol>
      </AccordionItem>

      <AccordionItem
        title="Backup & Restore"
        isOpen={open.backup}
        onToggle={() => setOpen((s) => ({ ...s, backup: !s.backup }))}
      >
        <ol className="list-decimal space-y-1">
          <li className="ml-5">Open Utility → <strong>Backup & Restore</strong>.</li>
          <li className="ml-5">Click <strong>Create Backup</strong>. When prompted by the browser, choose a location and save the <strong>.sql</strong> file.</li>
          <li className="ml-5">Wait for the <strong>Database backup created</strong> success message. The entry will appear in <strong>Backup History</strong>.</li>
          <li className="ml-5">To restore: pick a <strong>Restore Mode</strong> (e.g., Smart/Full), click <strong>Select File</strong>, choose a <strong>.sql</strong> backup.</li>
          <li className="ml-5">Click <strong>Restore</strong>. Confirm in the modal and wait for the success confirmation.</li>
          <li className="ml-5">Use pagination controls to review <strong>Backup History</strong> and verify latest activity.</li>
        </ol>
        <div className="mt-2"><Link to="/admin/help/backup-restore" className="text-blue-600 underline">Open detailed Backup & Restore help</Link></div>
      </AccordionItem>

      <AccordionItem
        title="Help Center"
        isOpen={open.helpCenter}
        onToggle={() => setOpen((s) => ({ ...s, helpCenter: !s.helpCenter }))}
      >
        <ol className="list-decimal space-y-1">
          <li className="ml-5">Open Utility → <strong>Help Center</strong>.</li>
          <li className="ml-5">Browse topics like <strong>Installing Dependencies</strong>, <strong>Imports</strong>, <strong>Boundary Editor</strong>, <strong>Backup & Restore</strong>, and more.</li>
          <li className="ml-5">Follow the ordered steps and screenshots to complete tasks.</li>
        </ol>
        <div className="mt-2"><Link to="/admin/help/help-center" className="text-blue-600 underline">Open detailed Help Center page</Link></div>
      </AccordionItem>

      <div className="mt-6">
        <Link to="/admin/help/help-center" className="text-blue-600 underline">Back to Help Center top</Link>
      </div>
      </div>
    </div>
  )
}

export default UtilityHelp