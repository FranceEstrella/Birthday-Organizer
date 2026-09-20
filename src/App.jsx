import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownAZ, ArrowUpDown, BarChart3, Bell, CalendarDays, Check, ChevronLeft, ChevronRight,
  CircleHelp, ChevronDown, Download, Edit3, ExternalLink, FileSpreadsheet, Filter, Gift, Grid2X2, LayoutDashboard, Menu, MoreHorizontal,
  Plus, Search, Settings, SlidersHorizontal, Sparkles, Trash2, Upload, Users, X, Cake,
} from 'lucide-react';
import {
  birthdayLabel, formatBirthday, getDaysUntilBirthday, getMonthDays, getNextBirthday,
} from './birthday';
import * as XLSX from 'xlsx';

const STORAGE_KEY = 'birthday-manager-data-v1';
const today = new Date();
const isoToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

const starterData = {
  setupComplete: false,
  profile: { name: '', email: '', role: 'Administrator' },
  organization: { name: '', timezone: 'Asia/Manila' },
  people: [],
  fields: [],
};

function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return starterData;
    const parsed = JSON.parse(stored);
    return {
      ...starterData,
      ...parsed,
      profile: { ...starterData.profile, ...parsed.profile },
      organization: { ...starterData.organization, ...parsed.organization },
      fields: parsed.fields || [],
      people: parsed.people || [],
      setupComplete: parsed.setupComplete ?? true,
    };
  } catch { return starterData; }
}

function saveData(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

function getDuplicateBirthdayGroups(people) {
  const groups = new Map();
  people.forEach((person) => {
    const key = `${person.name.trim().toLowerCase()}|${person.birthday}`;
    groups.set(key, [...(groups.get(key) || []), person]);
  });
  return [...groups.values()].filter((group) => group.length > 1);
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Overview' },
  { id: 'birthdays', label: 'Birthdays', icon: Gift, group: 'Manage' },
  { id: 'people', label: 'People', icon: Users, group: 'Manage' },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, group: 'Manage' },
  { id: 'fields', label: 'Custom fields', icon: SlidersHorizontal, group: 'Customize' },
  { id: 'settings', label: 'Settings', icon: Settings, group: 'System' },
];

function App() {
  const [data, setData] = useState(loadData);
  const [page, setPage] = useState('dashboard');
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => saveData(data), [data]);
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(''), 2800); return () => clearTimeout(timer); } }, [toast]);
  useEffect(() => { document.querySelectorAll('input[type="file"]').forEach((input) => { input.accept = '.csv,.xlsx'; }); });

  const updatePeople = (people) => setData((current) => ({ ...current, people }));
  const openPerson = (person) => setSelectedPerson(person);
  const closePerson = () => setSelectedPerson(null);
  const notify = (message) => setToast(message);
  const addNotification = (title, body) => setNotifications((current) => [{ id: `${Date.now()}-${Math.random()}`, title, body, time: 'Just now', unread: true }, ...current].slice(0, 20));
  const duplicateNoticeRef = useRef('');
  useEffect(() => {
    const groups = getDuplicateBirthdayGroups(data.people);
    const signature = groups.map((group) => group.map((person) => person.id).join(',')).join('|');
    if (signature && signature !== duplicateNoticeRef.current) {
      const count = groups.reduce((total, group) => total + group.length - 1, 0);
      addNotification('Possible duplicate birthdays', `${count} extra record${count === 1 ? '' : 's'} may belong to people already in your directory.`);
      duplicateNoticeRef.current = signature;
    }
    if (!signature) duplicateNoticeRef.current = '';
  }, [data.people]);

  function handleSavePerson(person) {
    const exists = data.people.some((item) => item.id === person.id);
    updatePeople(exists ? data.people.map((item) => item.id === person.id ? person : item) : [...data.people, person]);
    setModal(null); setSelectedPerson(null); notify(exists ? 'Person updated.' : 'Person added.');
  }

  function handleDeletePerson(person) {
    updatePeople(data.people.filter((item) => item.id !== person.id));
    setSelectedPerson(null); setModal(null); notify('Person deleted.');
  }

  function updatePersonField(personId, fieldName, value) { setData((current) => ({ ...current, people: current.people.map((person) => person.id === personId ? { ...person, fields: { ...person.fields, [fieldName]: value } } : person) })); }

  function handleImport(file) { setImportFile(file); }
  function finishImport(imported, overwrittenIds = [], details = {}) {
    const importedFieldNames = [...new Set(imported.flatMap((person) => Object.keys(person.fields || {})))];
    const newFields = importedFieldNames.filter((name) => !data.fields.some((field) => field.name === name)).map((name) => ({ id: `f-import-${Date.now()}-${name}`, name, type: imported.find((person) => person.fieldTypes?.[name])?.fieldTypes?.[name] || (imported.some((person) => /^https?:\/\//i.test(person.fields?.[name] || '')) ? 'URL' : 'Text'), options: [] }));
    updatePeople([...data.people.filter((person) => !overwrittenIds.includes(person.id)), ...imported.map(({ fieldTypes, ...person }) => person)]);
    if (newFields.length) setData((current) => ({ ...current, fields: [...current.fields, ...newFields] }));
    setImportFile(null); setPage('birthdays'); notify(`${imported.length} people imported.`);
    addNotification('Import completed', `${imported.length} people were added to Birthdays.`);
    if (details.invalidSkipped) addNotification('Rows skipped', `${details.invalidSkipped} rows had a missing or invalid birthday.`);
    if (details.duplicateSkipped) addNotification('Possible duplicates skipped', `${details.duplicateSkipped} matching people were left unchanged.`);
    if (details.duplicateOverwritten) addNotification('Duplicates overwritten', `${details.duplicateOverwritten} matching people were replaced.`);
  }

  function cleanupDuplicates() {
    const groups = getDuplicateBirthdayGroups(data.people);
    const duplicateIds = new Set(groups.flatMap((group) => group.slice(1).map((person) => person.id)));
    if (!duplicateIds.size) return;
    updatePeople(data.people.filter((person) => !duplicateIds.has(person.id)));
    setPage('birthdays');
    notify(`${duplicateIds.size} duplicate birthday records removed.`);
    addNotification('Birthday records cleaned up', `${duplicateIds.size} duplicate records were removed.`);
  }

  function completeOnboarding(profile, organization, importedPeople) {
    setData((current) => ({ ...current, profile, organization, people: importedPeople, setupComplete: true }));
  }

  function exportCsv() {
    const fieldNames = data.fields.map((field) => field.name);
    const rows = [['Name', 'Birthday', 'Notes', ...fieldNames], ...data.people.map((person) => [person.name, person.birthday, person.notes || '', ...fieldNames.map((name) => person.fields?.[name] || '')])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = 'birthday-manager-export.csv'; link.click(); notify('Export started.');
  }

  const pageTitle = navItems.find((item) => item.id === page)?.label || 'Dashboard';
  if (!data.setupComplete) return <Onboarding data={data} onComplete={completeOnboarding} />;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'is-open' : ''}`}>
        <div className="brand"><span className="brand-mark"><Cake size={20} /></span><span>Birthday<br /><strong>Manager</strong></span><button className="icon-button sidebar-close" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={18} /></button></div>
        <div className="workspace-switcher"><span className="workspace-avatar">{data.organization.name.charAt(0) || 'O'}</span><span><strong>{data.organization.name || 'Your organization'}</strong><small>Personal workspace</small></span><ChevronRight size={16} /></div>
        <nav className="side-nav">{['Overview', 'Manage', 'Customize', 'System'].map((group) => <div className="nav-group" key={group}><small>{group}</small>{navItems.filter((item) => item.group === group).map((item) => { const Icon = item.icon; return <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => { setPage(item.id); setMobileNav(false); }}><Icon size={17} />{item.label}{item.id === 'birthdays' && <span className="nav-count">{data.people.length}</span>}</button>; })}</div>)}</nav>
        <div className="sidebar-footer"><div className="tip"><Sparkles size={16} /><span><strong>Small moments matter.</strong><br />Keep your people close.</span></div><button className="profile-chip"><span className="profile-avatar">{data.profile.name.charAt(0) || 'A'}</span><span><strong>{data.profile.name || 'Your profile'}</strong><small>{data.profile.role}</small></span><MoreHorizontal size={17} /></button></div>
      </aside>
      {mobileNav && <button className="mobile-scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
      <main className="main-content">
        <header className="topbar"><button className="icon-button menu-button" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={20} /></button><div className="crumb"><span>Workspace</span><ChevronRight size={14} /><strong>{pageTitle}</strong></div><div className="top-actions"><button className="icon-button" aria-label="Help"><CircleHelp size={18} /></button><div className="notification-wrap"><button className="icon-button notification-button" onClick={() => { setNotificationsOpen((current) => !current); setNotifications((current) => current.map((item) => ({ ...item, unread: false }))); }} aria-label="Notifications"><Bell size={18} />{notifications.some((item) => item.unread) && <i />}</button>{notificationsOpen && <NotificationPanel notifications={notifications} onClose={() => setNotificationsOpen(false)} />}</div><button className="avatar-button">{data.profile.name.charAt(0) || 'A'}</button></div></header>
        <div className="page-wrap">{page === 'dashboard' && <Dashboard data={data} onNavigate={setPage} onOpen={openPerson} onAdd={() => setModal('person')} />}{page === 'birthdays' && <Birthdays data={data} onOpen={openPerson} onAdd={() => setModal('person')} onImport={handleImport} onExport={exportCsv} onCleanup={cleanupDuplicates} onUpdateField={updatePersonField} />}{page === 'people' && <People data={data} onOpen={openPerson} onAdd={() => setModal('person')} onImport={handleImport} onExport={exportCsv} />}{page === 'calendar' && <CalendarView data={data} onOpen={openPerson} />}{page === 'fields' && <Fields data={data} setData={setData} notify={notify} />}{page === 'settings' && <SettingsView data={data} setData={setData} onImport={handleImport} onExport={exportCsv} notify={notify} />}</div>
      </main>
      {selectedPerson && <PersonDrawer person={selectedPerson} fields={data.fields} onClose={closePerson} onEdit={() => setModal({ type: 'person', person: selectedPerson })} onDelete={() => setModal({ type: 'delete', person: selectedPerson })} />}
      {importFile && <ImportWizard file={importFile} people={data.people} onCancel={() => setImportFile(null)} onConfirm={finishImport} />}
      {modal?.type === 'delete' && <ConfirmDelete person={modal.person} onCancel={() => setModal(null)} onConfirm={() => handleDeletePerson(modal.person)} />}
      {(modal === 'person' || modal?.type === 'person') && <PersonForm person={modal.person} fields={data.fields} onCancel={() => setModal(null)} onSave={handleSavePerson} />}
      {toast && <div className="toast"><Check size={17} />{toast}</div>}
    </div>
  );
}

function NotificationPanel({ notifications, onClose }) {
  return <div className="notification-panel"><div className="notification-panel-head"><div><p className="eyebrow">Updates</p><h3>Notifications</h3></div><button className="icon-button" onClick={onClose} aria-label="Close notifications"><X size={16} /></button></div>{notifications.length ? <div className="notification-list">{notifications.map((item) => <div className="notification-item" key={item.id}><span className="notification-dot"><Bell size={13} /></span><span><strong>{item.title}</strong><small>{item.body}</small><em>{item.time}</em></span></div>)}</div> : <div className="notification-empty"><Bell size={20} /><p>Nothing new yet.</p></div>}</div>;
}

function normalizeImportedDate(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parts = text.split(/[\/.-]/).map(Number);
  if (parts.length === 3 && parts.every(Boolean)) {
    const [first, second, third] = parts;
    const year = first > 31 ? first : third;
    const month = first > 31 ? second : first;
    const day = first > 31 ? third : second;
    if (year > 1900 && month <= 12 && day <= 31) return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return '';
}

function LegacyImportWizard({ file, onCancel, onConfirm }) {
  const [workbook, setWorkbook] = useState(null);
  const [selectedSheets, setSelectedSheets] = useState([]);
  const [sheetData, setSheetData] = useState({});
  const [mapping, setMapping] = useState({ name: '', birthday: '', notes: '' });
  const [additionalMappings, setAdditionalMappings] = useState([]);
  const [step, setStep] = useState('loading');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState([]);

  useEffect(() => {
    let active = true;
    file.arrayBuffer().then((buffer) => {
      const parsed = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheets = Object.fromEntries(parsed.SheetNames.map((name) => [name, XLSX.utils.sheet_to_json(parsed.Sheets[name], { header: 1, defval: '', raw: true })]));
      if (!active) return;
      setWorkbook(parsed); setSheetData(sheets); setSelectedSheets(parsed.SheetNames.slice(0, 1)); setStep(parsed.SheetNames.length > 1 ? 'sheets' : 'mapping');
    }).catch(() => { if (active) { setError('This file could not be read. Try a CSV or XLSX workbook.'); setStep('error'); } });
    return () => { active = false; };
  }, [file]);

  const headers = useMemo(() => { const firstRows = sheetData[selectedSheets[0]] || []; return (firstRows[0] || []).map((header, index) => String(header || `Column ${index + 1}`)); }, [selectedSheets, sheetData]);
  const rows = useMemo(() => selectedSheets.flatMap((sheet) => { const values = sheetData[sheet] || []; return values.slice(1).map((row) => ({ sheet, row })); }), [selectedSheets, sheetData]);
  const updateMapping = (key, value) => setMapping((current) => ({ ...current, [key]: value }));
  const updateAdditionalMapping = (index, key, value) => setAdditionalMappings((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  const buildImported = () => rows.map(({ sheet, row }, index) => ({ sheet, row, index })).filter(({ row }) => row[Number(mapping.name)] && normalizeImportedDate(row[Number(mapping.birthday)])).map(({ row, index }) => ({ id: `import-${Date.now()}-${index}`, name: String(row[Number(mapping.name)]).trim(), birthday: normalizeImportedDate(row[Number(mapping.birthday)]), notes: mapping.notes ? String(row[Number(mapping.notes)] || '').trim() : '', fields: Object.fromEntries(additionalMappings.filter((item) => item.field.trim() && item.column !== '').map((item) => [item.field.trim(), String(row[Number(item.column)] || '').trim()])), createdAt: isoToday }));
  const makePreview = () => {
    if (!mapping.name || !mapping.birthday) { setError('Map both Name and Birthday before continuing.'); return; }
    const imported = buildImported();
    if (!imported.length) { setError('No valid rows found. Check the mapped columns and date values.'); return; }
    setError(''); setPreview(imported); setStep('preview');
  };
  const confirm = () => {
    const imported = buildImported();
    if (!imported.length) { setError('No valid rows found. Check the mapped columns and date values.'); return; }
    onConfirm(imported);
  };
  const toggleSheet = (name) => setSelectedSheets((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  const stage = step === 'sheets' ? 1 : step === 'mapping' ? 2 : step === 'preview' ? 3 : 0;
  return <div className="modal-scrim"><div className="modal import-modal"><div className="modal-heading"><div className="import-title"><span className="import-file-icon"><FileSpreadsheet size={19} /></span><div><p className="eyebrow">Import people</p><h2>{file.name}</h2></div></div><button className="icon-button" onClick={onCancel} aria-label="Close import"><X size={19} /></button></div>{step !== 'loading' && step !== 'error' && <div className="import-steps"><span className={stage >= 1 ? 'active' : ''}>1 <small>Choose sheets</small></span><i /><span className={stage >= 2 ? 'active' : ''}>2 <small>Map columns</small></span><i /><span className={stage >= 3 ? 'active' : ''}>3 <small>Review</small></span></div>}{step === 'loading' && <div className="import-loading"><FileSpreadsheet size={22} /><p>Reading your workbook...</p></div>}{step === 'error' && <><p className="form-error">{error}</p><div className="modal-actions"><Button variant="secondary" onClick={onCancel}>Close</Button></div></>}{step === 'sheets' && <><p className="import-intro">This workbook has multiple sheets. Choose which ones should become people.</p><div className="sheet-list">{workbook.SheetNames.map((sheet) => <label className="sheet-option" key={sheet}><input type="checkbox" checked={selectedSheets.includes(sheet)} onChange={() => toggleSheet(sheet)} /><span><strong>{sheet}</strong><small>{Math.max((sheetData[sheet] || []).length - 1, 0)} data rows</small></span><Check size={16} /></label>)}</div><div className="modal-actions"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button onClick={() => { if (!selectedSheets.length) { setError('Choose at least one sheet.'); return; } setStep('mapping'); }}>Map columns</Button></div></>}{step === 'mapping' && <><p className="import-intro">Match the columns once, then we will use that mapping across the selected sheets.</p><div className="mapping-grid"><ImportMapping label="Name" value={mapping.name} headers={headers} onChange={(value) => updateMapping('name', value)} required /><ImportMapping label="Birthday" value={mapping.birthday} headers={headers} onChange={(value) => updateMapping('birthday', value)} required /><ImportMapping label="Notes" value={mapping.notes} headers={headers} onChange={(value) => updateMapping('notes', value)} /></div>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button onClick={makePreview}>Preview rows</Button></div></>}{step === 'preview' && <><p className="import-intro">Review a sample before adding anyone. Blank or invalid birthdays will be skipped.</p><div className="import-summary"><strong>{rows.length}</strong><span>rows found across {selectedSheets.length} sheet{selectedSheets.length === 1 ? '' : 's'}</span></div><div className="import-preview"><div className="preview-head"><span>Name</span><span>Birthday</span><span>Sheet</span></div>{preview.map((row, index) => <div className="preview-row" key={`${row.sheet}-${index}`}><span>{row.name || <em>Blank</em>}</span><span className={row.birthday ? '' : 'invalid-cell'}>{row.birthday || 'Invalid date'}</span><span>{row.sheet}</span></div>)}</div>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><Button variant="secondary" onClick={() => setStep('mapping')}>Back</Button><Button onClick={confirm}>Import valid rows</Button></div></>}</div></div>;
}

function ImportWizard({ file, people, onCancel, onConfirm }) {
  const [workbook, setWorkbook] = useState(null);
  const [selectedSheets, setSelectedSheets] = useState([]);
  const [sheetData, setSheetData] = useState({});
  const [mapping, setMapping] = useState({ name: '', birthday: '', notes: '' });
  const [extraMappings, setExtraMappings] = useState([]);
  const [duplicateChoices, setDuplicateChoices] = useState({});
  const [step, setStep] = useState('loading');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState([]);

  useEffect(() => {
    let active = true;
    file.arrayBuffer().then((buffer) => {
      const parsed = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheets = Object.fromEntries(parsed.SheetNames.map((name) => [name, XLSX.utils.sheet_to_json(parsed.Sheets[name], { header: 1, defval: '', raw: true })]));
      if (!active) return;
      setWorkbook(parsed); setSheetData(sheets); setSelectedSheets(parsed.SheetNames.slice(0, 1)); setStep(parsed.SheetNames.length > 1 ? 'sheets' : 'mapping');
    }).catch(() => { if (active) { setError('This file could not be read. Try a CSV or XLSX workbook.'); setStep('error'); } });
    return () => { active = false; };
  }, [file]);

  const headers = useMemo(() => { const values = sheetData[selectedSheets[0]] || []; return (values[0] || []).map((header, index) => String(header || `Column ${index + 1}`)); }, [selectedSheets, sheetData]);
  const rows = useMemo(() => selectedSheets.flatMap((sheet) => (sheetData[sheet] || []).slice(1).map((row) => ({ sheet, row }))), [selectedSheets, sheetData]);
  const updateMapping = (key, value) => setMapping((current) => ({ ...current, [key]: value }));
  const updateExtra = (index, key, value) => setExtraMappings((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  const buildImported = () => rows.map(({ sheet, row }, index) => ({ sheet, row, index })).filter(({ row }) => row[Number(mapping.name)] && normalizeImportedDate(row[Number(mapping.birthday)])).map(({ sheet, row, index }) => ({ id: `import-${Date.now()}-${index}`, name: String(row[Number(mapping.name)]).trim(), birthday: normalizeImportedDate(row[Number(mapping.birthday)]), notes: mapping.notes ? String(row[Number(mapping.notes)] || '').trim() : '', fields: Object.fromEntries(extraMappings.filter((item) => item.name.trim() && item.column !== '').map((item) => [item.name.trim(), String(row[Number(item.column)] || '').trim()])), fieldTypes: Object.fromEntries(extraMappings.filter((item) => item.name.trim() && item.column !== '').map((item) => [item.name.trim(), item.type || 'Dropdown'])), createdAt: isoToday, sourceSheet: sheet }));
  const makePreview = () => {
    if (!mapping.name || !mapping.birthday) { setError('Map both Name and Birthday before continuing.'); return; }
    const imported = buildImported();
    if (!imported.length) { setError('No valid rows found. Check the mapped columns and date values.'); return; }
    setError(''); setPreview(imported); setStep('preview');
  };
  const getDuplicates = (imported) => imported.map((person) => ({ imported: person, existing: people.find((current) => current.name.trim().toLowerCase() === person.name.trim().toLowerCase() && current.birthday === person.birthday) })).filter((match) => match.existing);
  const updateDuplicateChoice = (key, value) => setDuplicateChoices((current) => ({ ...current, [key]: value }));
  const finishWithDuplicatePolicy = (policy) => {
    const duplicates = getDuplicates(preview);
    const choices = Object.fromEntries(duplicates.map(({ imported, existing }) => [imported.id, policy === 'overwrite' ? 'overwrite' : 'keep']));
    setDuplicateChoices(choices);
    if (policy === 'manual') { setStep('duplicates'); return; }
    const overwrittenIds = duplicates.filter(({ imported }) => choices[imported.id] === 'overwrite').map(({ existing }) => existing.id);
    const imported = preview.filter((person) => !duplicates.some(({ imported: duplicate }) => duplicate.id === person.id) || choices[person.id] === 'overwrite').map(({ sourceSheet, ...person }) => person);
    onConfirm(imported, overwrittenIds, { duplicateOverwritten: duplicates.length, invalidSkipped: rows.length - preview.length });
  };
  const confirm = () => {
    const duplicates = getDuplicates(preview);
    if (!duplicates.length) { onConfirm(preview.map(({ sourceSheet, ...person }) => person), [], { invalidSkipped: rows.length - preview.length }); return; }
    const duplicateList = duplicates.map(({ imported: person }, index) => `${index + 1}. ${person.name}`).join('\n');
    const choice = window.prompt(`Duplicate people found:\n\n${duplicateList}\n\nType SKIP to keep current records, OVERWRITE to replace all, or MANUAL to choose specific numbers.`, 'SKIP')?.trim().toLowerCase();
    if (choice === 'overwrite') { finishWithDuplicatePolicy('overwrite'); return; }
    if (choice === 'manual') {
      const selected = window.prompt(`Enter the numbers to overwrite, separated by commas. All other duplicates will be skipped.\n\n${duplicateList}`, '') || '';
      const overwriteIndexes = new Set(selected.split(',').map((value) => Number(value.trim()) - 1).filter((value) => value >= 0 && value < duplicates.length));
      const overwrittenIds = duplicates.filter((_, index) => overwriteIndexes.has(index)).map(({ existing }) => existing.id);
      const imported = preview.filter((person) => !duplicates.some(({ imported: duplicate }) => duplicate.id === person.id) || overwriteIndexes.has(duplicates.findIndex(({ imported: duplicate }) => duplicate.id === person.id))).map(({ sourceSheet, ...person }) => person);
      onConfirm(imported, overwrittenIds, { duplicateSkipped: duplicates.length - overwriteIndexes.size, duplicateOverwritten: overwriteIndexes.size, invalidSkipped: rows.length - preview.length }); return;
    }
    const imported = preview.filter((person) => !duplicates.some(({ imported: duplicate }) => duplicate.id === person.id)).map(({ sourceSheet, ...person }) => person);
    onConfirm(imported, [], { duplicateSkipped: duplicates.length, invalidSkipped: rows.length - preview.length });
  };
  const toggleSheet = (name) => setSelectedSheets((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  const stage = step === 'sheets' ? 1 : step === 'mapping' ? 2 : step === 'preview' ? 3 : 0;
  return <div className="modal-scrim"><div className="modal import-modal"><div className="modal-heading"><div className="import-title"><span className="import-file-icon"><FileSpreadsheet size={19} /></span><div><p className="eyebrow">Import people</p><h2>{file.name}</h2></div></div><button className="icon-button" onClick={onCancel} aria-label="Close import"><X size={19} /></button></div>{step !== 'loading' && step !== 'error' && <div className="import-steps"><span className={stage >= 1 ? 'active' : ''}>1 <small>Choose sheets</small></span><i /><span className={stage >= 2 ? 'active' : ''}>2 <small>Map columns</small></span><i /><span className={stage >= 3 ? 'active' : ''}>3 <small>Review</small></span></div>}{step === 'loading' && <div className="import-loading"><FileSpreadsheet size={22} /><p>Reading your workbook...</p></div>}{step === 'error' && <><p className="form-error">{error}</p><div className="modal-actions"><Button variant="secondary" onClick={onCancel}>Close</Button></div></>}{step === 'sheets' && <><p className="import-intro">Choose the sheets that contain people. You can include more than one.</p><div className="sheet-list compact-sheet-list">{workbook.SheetNames.map((sheet) => <label className="sheet-option" key={sheet}><input type="checkbox" checked={selectedSheets.includes(sheet)} onChange={() => toggleSheet(sheet)} /><span><strong>{sheet}</strong><small>{Math.max((sheetData[sheet] || []).length - 1, 0)} rows</small></span><Check size={16} /></label>)}</div><div className="modal-actions"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button onClick={() => { if (!selectedSheets.length) { setError('Choose at least one sheet.'); return; } setStep('mapping'); }}>Map columns</Button></div></>}{step === 'mapping' && <><p className="import-intro">Map the required details, then add any other columns you want to keep.</p><div className="mapping-grid"><ImportMapping label="Name" value={mapping.name} headers={headers} onChange={(value) => updateMapping('name', value)} required /><ImportMapping label="Birthday" value={mapping.birthday} headers={headers} onChange={(value) => updateMapping('birthday', value)} required /><ImportMapping label="Notes" value={mapping.notes} headers={headers} onChange={(value) => updateMapping('notes', value)} /></div><div className="extra-mappings">{extraMappings.map((item, index) => <div className="extra-mapping" key={index}><input value={item.name} onChange={(event) => updateExtra(index, 'name', event.target.value)} placeholder="New field name" /><ImportMapping label="" value={item.column} headers={headers} onChange={(value) => updateExtra(index, 'column', value)} /><button className="icon-button danger" onClick={() => setExtraMappings((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove mapped column"><X size={16} /></button></div>)}</div><button className="add-mapping-button" onClick={() => setExtraMappings((current) => [...current, { name: '', column: '' }])}><Plus size={15} /> Add another column</button>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button onClick={makePreview}>Review {rows.length} rows</Button></div></>}{step === 'preview' && <><p className="import-intro">Everything listed below will be added. Invalid or blank birthdays were removed.</p><div className="import-summary"><strong>{preview.length}</strong><span>valid rows ready to import{rows.length > preview.length ? ` · ${rows.length - preview.length} skipped` : ''}</span></div><div className="import-preview full-preview"><div className="preview-head"><span>Name</span><span>Birthday</span><span>Sheet</span></div>{preview.map((row, index) => <div className="preview-row" key={`${row.id}-${index}`}><span>{row.name}</span><span>{row.birthday}</span><span>{row.sourceSheet}</span></div>)}</div>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><Button variant="secondary" onClick={() => setStep('mapping')}>Back</Button><Button onClick={confirm}>Import {preview.length} people</Button></div></>}</div></div>;
}

function SelectMenu({ value, options, onChange, ariaLabel, className = '' }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const selected = options.find((option) => option.value === value) || options[0];
  useEffect(() => {
    const close = (event) => { if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const stopRowClick = (event) => event.stopPropagation();
  const toggleMenu = (event) => { event.stopPropagation(); setOpen((current) => !current); };
  return <div className={`custom-select ${open ? 'is-open' : ''} ${className}`} ref={menuRef} onMouseDown={stopRowClick} onPointerDown={stopRowClick}><div role="button" tabIndex="0" className="custom-select-trigger" aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel} onClick={toggleMenu} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') toggleMenu(event); }}><span>{selected?.label || 'Choose an option'}</span><ChevronDown size={15} /></div>{open && <div className="custom-select-menu" role="listbox" onClick={(event) => event.stopPropagation()}>{options.map((option) => <div role="option" aria-selected={option.value === value} className={option.value === value ? 'selected' : ''} key={option.value} tabIndex="0" onClick={(event) => { event.stopPropagation(); onChange(option.value); setOpen(false); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.stopPropagation(); onChange(option.value); setOpen(false); } }}>{option.label}{option.value === value && <Check size={14} />}</div>)}</div>}</div>;
}

function ImportMapping({ label, value, headers, onChange, required }) { return <label className="mapping-field">{label} {!required && label && <span className="optional">Optional</span>}<SelectMenu ariaLabel={label || 'Mapped column'} value={value} onChange={onChange} options={[{ value: '', label: 'Choose a column' }, ...headers.map((header, index) => ({ value: String(index), label: header }))]} /></label>; }

function Onboarding({ data, onComplete }) {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState(data.profile);
  const [organization, setOrganization] = useState(data.organization);
  const [people, setPeople] = useState([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const updateProfile = (key, value) => setProfile((current) => ({ ...current, [key]: value }));
  const updateOrganization = (key, value) => setOrganization((current) => ({ ...current, [key]: value }));
  const parseImport = (file) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const lines = String(reader.result).split(/\r?\n/).filter(Boolean);
      const [header, ...rows] = lines.map((line) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')));
      const nameIndex = header?.findIndex((value) => value.toLowerCase() === 'name');
      const birthdayIndex = header?.findIndex((value) => value.toLowerCase() === 'birthday');
      if (nameIndex === -1 || birthdayIndex === -1) { setError('CSV needs Name and Birthday columns.'); return; }
      const notesIndex = header.findIndex((value) => value.toLowerCase() === 'notes');
      const imported = rows.filter((row) => row[nameIndex] && /^\d{4}-\d{2}-\d{2}$/.test(row[birthdayIndex])).map((row, index) => ({
        id: `import-${Date.now()}-${index}`, name: row[nameIndex], birthday: row[birthdayIndex], notes: notesIndex >= 0 ? row[notesIndex] || '' : '', fields: {}, createdAt: isoToday,
      }));
      setPeople(imported); setError(imported.length ? '' : 'No valid birthday rows were found.');
    };
    reader.readAsText(file);
  };
  const next = () => {
    setError('');
    if (step === 0 && !profile.name.trim()) { setError('Add your name to continue.'); return; }
    if (step === 1 && !organization.name.trim()) { setError('Add an organization name to continue.'); return; }
    if (step === 2) { onComplete({ ...profile, name: profile.name.trim() }, { ...organization, name: organization.name.trim() }, people); return; }
    setStep((current) => current + 1);
  };
  const skipImport = () => onComplete({ ...profile, name: profile.name.trim() }, { ...organization, name: organization.name.trim() }, []);
  return <div className="onboarding-shell"><div className="onboarding-card"><div className="onboarding-brand"><span className="brand-mark"><Cake size={20} /></span><strong>Birthday Manager</strong></div><div className="onboarding-progress"><span className={step >= 0 ? 'active' : ''} /><span className={step >= 1 ? 'active' : ''} /><span className={step >= 2 ? 'active' : ''} /></div>{step === 0 && <div className="onboarding-step"><div className="onboarding-art"><Users size={27} /><Sparkles size={17} /></div><p className="eyebrow">Let’s make it yours</p><h1>Start with your profile.</h1><p className="onboarding-copy">A few details help your workspace feel like home. Everything stays on this device.</p><label>Your name<input autoFocus value={profile.name} onChange={(event) => updateProfile('name', event.target.value)} placeholder="e.g. France Estrella" /></label><label>Email <span className="optional">Optional</span><input type="email" value={profile.email} onChange={(event) => updateProfile('email', event.target.value)} placeholder="you@example.com" /></label></div>}{step === 1 && <div className="onboarding-step"><div className="onboarding-art coral-art"><Grid2X2 size={27} /></div><p className="eyebrow">Your shared space</p><h1>Name your organization.</h1><p className="onboarding-copy">This is the workspace name your team will see in the sidebar.</p><label>Organization name<input autoFocus value={organization.name} onChange={(event) => updateOrganization('name', event.target.value)} placeholder="e.g. Northstar Collective" /></label><label>Timezone<select value={organization.timezone} onChange={(event) => updateOrganization('timezone', event.target.value)}><option>Asia/Manila</option><option>Asia/Singapore</option><option>America/New_York</option><option>Europe/London</option></select></label></div>}{step === 2 && <div className="onboarding-step"><div className="onboarding-art lime-art"><Upload size={27} /></div><p className="eyebrow">Bring your birthdays along</p><h1>Import your people.</h1><p className="onboarding-copy">Upload a CSV with <strong>Name</strong> and <strong>Birthday</strong> columns. You can always add people later.</p><input ref={fileRef} type="file" accept=".csv" hidden onChange={(event) => event.target.files[0] && parseImport(event.target.files[0])} />{fileName ? <div className="selected-file"><Check size={17} /><span><strong>{fileName}</strong><small>{people.length} valid people ready to import</small></span><button className="icon-button" onClick={() => { setFileName(''); setPeople([]); }} aria-label="Remove selected file"><X size={17} /></button></div> : <button className="upload-dropzone" onClick={() => fileRef.current?.click()}><Upload size={20} /><strong>Choose a CSV file</strong><small>or skip and add people manually</small></button>}</div>}{error && <p className="form-error">{error}</p>}<div className="onboarding-actions">{step > 0 && <button className="text-button" onClick={() => { setError(''); setStep((current) => current - 1); }}><ChevronLeft size={15} /> Back</button>}{step === 2 && <button className="text-button skip-button" onClick={skipImport}>Skip for now</button>}<Button icon={step === 2 ? Check : ChevronRight} onClick={next}>{step === 2 ? 'Open my workspace' : 'Continue'}</Button></div><p className="local-note"><Sparkles size={14} /> Your data is saved locally in this browser.</p></div></div>;
}

function PageHeader({ eyebrow, title, description, action, children }) { return <div className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div><div className="header-actions">{children}{action}</div></div>; }
function Button({ children, onClick, variant = 'primary', icon: Icon, type = 'button' }) { return <button type={type} className={`button ${variant}`} onClick={onClick}>{Icon && <Icon size={17} />}{children}</button>; }
function Stat({ label, value, icon: Icon, accent, onClick }) { return <button className={`stat-card ${accent || ''}`} onClick={onClick}><span className="stat-icon"><Icon size={18} /></span><span className="stat-label">{label}</span><strong>{value}</strong></button>; }
function getSortedPeople(people) { return [...people].sort((a, b) => getDaysUntilBirthday(a.birthday) - getDaysUntilBirthday(b.birthday)); }

function Dashboard({ data, onNavigate, onOpen, onAdd }) {
  const sorted = getSortedPeople(data.people); const todayCount = data.people.filter((person) => getDaysUntilBirthday(person.birthday) === 0).length; const weekCount = data.people.filter((person) => getDaysUntilBirthday(person.birthday) <= 7).length; const monthCount = data.people.filter((person) => getDaysUntilBirthday(person.birthday) <= 31).length; const next = sorted[0];
  const monthCounts = Array.from({ length: 12 }, (_, month) => data.people.filter((person) => Number(person.birthday.slice(5, 7)) - 1 === month).length); const maxMonth = Math.max(...monthCounts, 1);
  return <>
    <PageHeader eyebrow={today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} title={`Good afternoon, ${data.profile.name.split(' ')[0] || 'there'}`} description="A clear view of the moments worth remembering." action={<Button icon={Plus} onClick={onAdd}>Add person</Button>} />
    <section className="stats-grid"><Stat label="Total people" value={data.people.length} icon={Users} /><Stat label="Birthdays this week" value={weekCount} icon={Gift} accent="stat-coral" onClick={() => onNavigate('birthdays')} /><Stat label="Birthdays today" value={todayCount} icon={Sparkles} accent="stat-lime" onClick={() => onNavigate('birthdays')} /><Stat label="This month" value={monthCount} icon={BarChart3} accent="stat-blue" /></section>
    <section className="dashboard-grid"><div className="next-card"><div className="next-card-top"><span className="eyebrow">Next up</span><span className="next-badge"><Gift size={14} /> {next ? birthdayLabel(next.birthday) : 'No birthdays'}</span></div>{next ? <><div className="next-person"><div className="big-avatar">{next.name.split(' ').map((part) => part[0]).join('')}</div><div><h2>{next.name}</h2><p>{formatBirthday(next.birthday, { month: 'long', day: 'numeric' })}</p></div></div><div className="next-footer"><span><strong>{getDaysUntilBirthday(next.birthday)}</strong> days to go</span><button onClick={() => onOpen(next)}>Open profile <ChevronRight size={16} /></button></div></> : <EmptyState compact onAdd={onAdd} />}</div>
      <div className="upcoming-panel panel"><div className="panel-heading"><div><p className="eyebrow">The next few</p><h2>Upcoming birthdays</h2></div><button className="text-button" onClick={() => onNavigate('birthdays')}>View all <ChevronRight size={15} /></button></div><div className="upcoming-list">{sorted.slice(0, 4).map((person) => <button className="upcoming-row" key={person.id} onClick={() => onOpen(person)}><span className={`mini-avatar color-${person.id.slice(-1)}`}>{person.name.charAt(0)}</span><span className="upcoming-name"><strong>{person.name}</strong><small>{formatBirthday(person.birthday)}</small></span><span className="upcoming-count">{birthdayLabel(person.birthday)}</span><ChevronRight size={15} /></button>)}</div></div></section>
    <section className="panel distribution"><div className="panel-heading"><div><p className="eyebrow">A little perspective</p><h2>Birthday distribution</h2></div><span className="muted">{data.people.length} people across the year</span></div><div className="bar-chart">{monthCounts.map((count, index) => <div className="bar-item" key={index}><div className="bar-track"><span style={{ height: `${Math.max(count / maxMonth * 100, count ? 24 : 5)}%` }} /></div><small>{new Date(2000, index).toLocaleString('en-US', { month: 'short' })}</small></div>)}</div></section>
  </>;
}

function People({ data, onOpen, onAdd, onImport, onExport }) { return <DirectoryPage mode="people" data={data} onOpen={onOpen} onAdd={onAdd} onImport={onImport} onExport={onExport} />; }
function Birthdays({ data, onOpen, onAdd, onImport, onExport, onCleanup, onUpdateField }) { return <DirectoryPage mode="birthdays" data={data} onOpen={onOpen} onAdd={onAdd} onImport={onImport} onExport={onExport} onCleanup={onCleanup} onUpdateField={onUpdateField} />; }

function LegacyDirectoryPage({ mode, data, onOpen, onAdd, onImport, onExport }) {
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('all'); const [sort, setSort] = useState(mode === 'birthdays' ? 'upcoming' : 'name'); const fileRef = useRef(null);
  const visiblePeople = useMemo(() => data.people.filter((person) => { const haystack = `${person.name} ${person.notes} ${Object.values(person.fields || {}).join(' ')}`.toLowerCase(); const days = getDaysUntilBirthday(person.birthday); return haystack.includes(query.toLowerCase()) && (filter === 'all' || (filter === 'today' && days === 0) || (filter === 'week' && days <= 7) || (filter === 'month' && days <= 31)); }).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'recent' ? b.createdAt.localeCompare(a.createdAt) : getDaysUntilBirthday(a.birthday) - getDaysUntilBirthday(b.birthday)), [data.people, filter, query, sort]);
  return <><PageHeader eyebrow={mode === 'birthdays' ? 'Keep the date' : 'The directory'} title={mode === 'birthdays' ? 'Birthdays' : 'People'} description={mode === 'birthdays' ? 'The moments coming up, in the order they arrive.' : 'Everyone in your organization, with the details that matter.'} action={<Button icon={Plus} onClick={onAdd}>Add person</Button>}><div className="secondary-actions"><button className="icon-button bordered" onClick={() => fileRef.current?.click()} aria-label="Import CSV"><Upload size={17} /></button><input ref={fileRef} type="file" accept=".csv" hidden onChange={(event) => event.target.files[0] && onImport(event.target.files[0])} /><button className="icon-button bordered" onClick={onExport} aria-label="Export CSV"><Download size={17} /></button></div></PageHeader><div className="toolbar"><div className="search-box"><Search size={17} /><input placeholder="Search names, notes, or fields" value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="toolbar-right"><div className="select-wrap"><Filter size={15} /><SelectMenu ariaLabel="Birthday filter" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All people' }, { value: 'today', label: 'Today' }, { value: 'week', label: 'Next 7 days' }, { value: 'month', label: 'Next 30 days' }]} /></div><div className="select-wrap"><ArrowUpDown size={15} /><SelectMenu ariaLabel="Sort people" value={sort} onChange={setSort} options={[{ value: 'upcoming', label: 'Upcoming first' }, { value: 'name', label: 'Name A-Z' }, { value: 'recent', label: 'Recently added' }]} /></div></div></div><div className="directory-table panel"><div className="table-head"><span>Name</span><span>Birthday</span><span>{mode === 'birthdays' ? 'Days until' : 'Details'}</span><span>Notes</span><span /></div>{visiblePeople.length ? visiblePeople.map((person) => <button className="table-row" key={person.id} onClick={() => onOpen(person)}><span className="person-cell"><span className={`mini-avatar color-${person.id.slice(-1)}`}>{person.name.charAt(0)}</span><strong>{person.name}</strong></span><span>{formatBirthday(person.birthday, { month: 'short', day: 'numeric', year: 'numeric' })}</span><span className={getDaysUntilBirthday(person.birthday) === 0 ? 'today-text' : ''}>{mode === 'birthdays' ? birthdayLabel(person.birthday) : Object.entries(person.fields || {}).slice(0, 2).map(([key, value]) => <small className="detail-line" key={key}>{key}: {value}</small>)}</span><span className="note-cell">{person.notes || <span className="muted">No notes yet</span>}</span><MoreHorizontal size={18} /></button>) : <EmptyState message={query ? 'No people found' : 'No people yet'} description={query ? 'Try another name or remove some filters.' : 'Add your first person to start organizing birthdays.'} onAdd={onAdd} />}</div></>;
}

function BirthdayDirectoryPage({ data, onOpen, onAdd, onImport, onExport, onUpdateField }) {
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('all'); const [sort, setSort] = useState('upcoming'); const fileRef = useRef(null); const quickFields = data.fields.filter((field) => field.showOnBirthdays);
  const visiblePeople = useMemo(() => data.people.filter((person) => { const haystack = `${person.name} ${person.notes} ${Object.values(person.fields || {}).join(' ')}`.toLowerCase(); const days = getDaysUntilBirthday(person.birthday); return haystack.includes(query.toLowerCase()) && (filter === 'all' || (filter === 'today' && days === 0) || (filter === 'week' && days <= 7) || (filter === 'month' && days <= 31)); }).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'recent' ? b.createdAt.localeCompare(a.createdAt) : getDaysUntilBirthday(a.birthday) - getDaysUntilBirthday(b.birthday)), [data.people, filter, query, sort]);
  return <><PageHeader eyebrow="Keep the date" title="Birthdays" description="The moments coming up, in the order they arrive." action={<Button icon={Plus} onClick={onAdd}>Add person</Button>}><div className="secondary-actions"><button className="icon-button bordered" onClick={() => fileRef.current?.click()} aria-label="Import CSV or XLSX"><Upload size={17} /></button><input ref={fileRef} type="file" accept=".csv,.xlsx" hidden onChange={(event) => event.target.files[0] && onImport(event.target.files[0])} /><button className="icon-button bordered" onClick={onExport} aria-label="Export CSV"><Download size={17} /></button></div></PageHeader><div className="toolbar"><div className="search-box"><Search size={17} /><input placeholder="Search names, notes, or fields" value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="toolbar-right"><div className="select-wrap"><Filter size={15} /><SelectMenu ariaLabel="Birthday filter" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All people' }, { value: 'today', label: 'Today' }, { value: 'week', label: 'Next 7 days' }, { value: 'month', label: 'Next 30 days' }]} /></div><div className="select-wrap"><ArrowUpDown size={15} /><SelectMenu ariaLabel="Sort people" value={sort} onChange={setSort} options={[{ value: 'upcoming', label: 'Upcoming first' }, { value: 'name', label: 'Name A-Z' }, { value: 'recent', label: 'Recently added' }]} /></div></div></div><div className={`directory-table panel birthday-table quick-field-count-${quickFields.length}`}><div className="table-head"><span>Name</span><span>Birthday</span><span>Days until</span>{quickFields.map((field) => <span key={field.id}>{field.name}</span>)}<span>Notes</span><span /></div>{visiblePeople.length ? visiblePeople.map((person) => <button className="table-row" key={person.id} onClick={() => onOpen(person)}><span className="person-cell"><span className={`mini-avatar color-${person.id.slice(-1)}`}>{person.name.charAt(0)}</span><strong>{person.name}</strong></span><span>{formatBirthday(person.birthday, { month: 'short', day: 'numeric', year: 'numeric' })}</span><span className={getDaysUntilBirthday(person.birthday) === 0 ? 'today-text' : ''}>{birthdayLabel(person.birthday)}</span>{quickFields.map((field) => <span key={field.id} className="quick-field-value"><FieldValue field={field} value={person.fields?.[field.name]} onChange={(value) => onUpdateField(person.id, field.name, value)} /></span>)}<span className="note-cell">{person.notes || <span className="muted">No notes yet</span>}</span><MoreHorizontal size={18} /></button>) : <EmptyState message={query ? 'No people found' : 'No birthdays yet'} description={query ? 'Try another name or remove some filters.' : 'Add your first person to start organizing birthdays.'} onAdd={onAdd} />}</div></>;
}

function DirectoryPage({ mode, data, onOpen, onAdd, onImport, onExport, onCleanup, onUpdateField }) {
  const duplicateGroups = mode === 'birthdays' ? getDuplicateBirthdayGroups(data.people) : [];
  return <>{duplicateGroups.length > 0 && <DuplicateBirthdayNotice groups={duplicateGroups} onCleanup={onCleanup} />}{mode === 'birthdays' ? <BirthdayDirectoryPage data={data} onOpen={onOpen} onAdd={onAdd} onImport={onImport} onExport={onExport} onUpdateField={onUpdateField} /> : <LegacyDirectoryPage mode={mode} data={data} onOpen={onOpen} onAdd={onAdd} onImport={onImport} onExport={onExport} />}</>;
}

function DuplicateBirthdayNotice({ groups, onCleanup }) {
  const duplicateCount = groups.reduce((total, group) => total + group.length - 1, 0);
  return <div className="duplicate-notice"><span className="duplicate-notice-icon"><Gift size={17} /></span><span><strong>Possible duplicate birthdays</strong><small>{duplicateCount} extra record{duplicateCount === 1 ? '' : 's'} found across {groups.length} person{groups.length === 1 ? '' : 's'}.</small></span><Button variant="secondary" onClick={onCleanup}>Clean up</Button></div>;
}

function CalendarView({ data, onOpen }) {
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1)); const year = month.getFullYear(); const monthIndex = month.getMonth(); const firstDay = new Date(year, monthIndex, 1).getDay(); const days = getMonthDays(year, monthIndex); const weeks = Math.ceil((firstDay + days) / 7); const byDay = new Map(); data.people.forEach((person) => { const birthdayMonth = Number(person.birthday.slice(5, 7)) - 1; const birthdayDay = Number(person.birthday.slice(8, 10)); if (birthdayMonth === monthIndex) byDay.set(birthdayDay, [...(byDay.get(birthdayDay) || []), person]); });
  return <><PageHeader eyebrow="See the year" title="Calendar" description="A month-by-month view of the people you are celebrating." /><div className="calendar-panel panel"><div className="calendar-nav"><button className="icon-button bordered" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))} aria-label="Previous month"><ChevronLeft size={18} /></button><h2>{month.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</h2><button className="icon-button bordered" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))} aria-label="Next month"><ChevronRight size={18} /></button><button className="button small secondary" onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>Today</button></div><div className="calendar-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{Array.from({ length: weeks * 7 }, (_, index) => { const day = index - firstDay + 1; const people = byDay.get(day) || []; return <div className={`calendar-day ${day < 1 || day > days ? 'outside' : ''} ${day === today.getDate() && monthIndex === today.getMonth() && year === today.getFullYear() ? 'current-day' : ''}`} key={index}>{day > 0 && day <= days && <><span className="day-number">{day}</span>{people.map((person) => <button className="calendar-person" key={person.id} onClick={() => onOpen(person)}><Gift size={12} />{person.name.split(' ')[0]}</button>)}</>}</div>; })}</div></div></>;
}

function FieldValue({ field, value, onChange }) {
  const type = String(field.type || 'Text').toLowerCase();
  if ((value === undefined || value === null || value === '') && !(type === 'dropdown' && onChange && field.options?.length)) return 'Not set';
  if (type === 'url' || /^https?:\/\//i.test(value)) return <a className="field-link" href={value} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Open <ExternalLink size={13} /></a>;
  if (type === 'checkbox') return /^(true|yes|1|checked)$/i.test(String(value)) ? <span className="quick-check is-checked"><Check size={12} /> Yes</span> : <span className="quick-check">No</span>;
  if (type === 'date') { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  if (type === 'multi-select') return <span className="quick-tags">{String(value).split(',').map((item) => <em key={item.trim()}>{item.trim()}</em>)}</span>;
  if (type === 'dropdown') return onChange && field.options?.length ? <SelectMenu ariaLabel={`${field.name} value`} value={String(value || '')} onChange={onChange} options={[{ value: '', label: 'Choose a value' }, ...field.options.map((option) => ({ value: option, label: option }))]} className="quick-field-select" /> : <span className="quick-badge">{value}</span>;
  return value;
}

function PersonDrawer({ person, fields, onClose, onEdit, onDelete }) { return <><button className="drawer-scrim" onClick={onClose} aria-label="Close profile" /><aside className="person-drawer"><div className="drawer-top"><span className="eyebrow">Person profile</span><button className="icon-button" onClick={onClose} aria-label="Close profile"><X size={19} /></button></div><div className="drawer-identity"><div className="drawer-avatar">{person.name.split(' ').map((part) => part[0]).join('')}</div><h2>{person.name}</h2><p className="birthday-highlight"><Gift size={16} /> {formatBirthday(person.birthday, { month: 'long', day: 'numeric' })} <span>· {birthdayLabel(person.birthday)}</span></p></div><div className="drawer-actions"><Button icon={Edit3} onClick={onEdit}>Edit person</Button><button className="icon-button bordered danger" onClick={onDelete} aria-label="Delete person"><Trash2 size={17} /></button></div><div className="drawer-section"><h3>Information</h3><div className="info-list"><div><span>Birthday</span><strong>{formatBirthday(person.birthday, { month: 'long', day: 'numeric', year: 'numeric' })}</strong></div>{fields.map((field) => <div key={field.id}><span>{field.name}</span><strong><FieldValue field={field} value={person.fields?.[field.name]} /></strong></div>)}</div></div><div className="drawer-section"><div className="section-title"><h3>Notes</h3><button className="text-button">Edit</button></div><p className="note-content">{person.notes || 'No notes yet. Add a note when there is something worth remembering.'}</p></div><div className="drawer-footnote"><Sparkles size={16} /><span>Saved locally on this device.</span></div></aside></>; }

function LegacyPersonForm({ person, fields, onCancel, onSave }) { const [form, setForm] = useState(person || { id: `p-${Date.now()}`, name: '', birthday: '', notes: '', fields: {}, createdAt: isoToday }); const [error, setError] = useState(''); const setValue = (key, value) => setForm((current) => ({ ...current, [key]: value })); const setField = (key, value) => setForm((current) => ({ ...current, fields: { ...current.fields, [key]: value } })); const submit = (event) => { event.preventDefault(); if (!form.name.trim()) { setError('Add a name to continue.'); return; } if (!/^\d{4}-\d{2}-\d{2}$/.test(form.birthday)) { setError('Choose a valid birthday.'); return; } onSave({ ...form, name: form.name.trim() }); };
  return <div className="modal-scrim"><form className="modal form-modal" onSubmit={submit}><div className="modal-heading"><div><p className="eyebrow">{person ? 'Update details' : 'New person'}</p><h2>{person ? 'Edit person' : 'Add a person'}</h2></div><button type="button" className="icon-button" onClick={onCancel} aria-label="Close"><X size={19} /></button></div><label>Full name<input autoFocus value={form.name} onChange={(event) => setValue('name', event.target.value)} placeholder="e.g. Maria Santos" /></label><label>Birthday<input type="date" value={form.birthday} onChange={(event) => setValue('birthday', event.target.value)} /></label><label>Notes <span className="optional">Optional</span><textarea rows="3" value={form.notes} onChange={(event) => setValue('notes', event.target.value)} placeholder="Anything worth remembering..." /></label>{fields.map((field) => <label key={field.id}>{field.name}<input value={form.fields?.[field.name] || ''} onChange={(event) => setField(field.name, event.target.value)} placeholder={field.type === 'Dropdown' ? `Choose ${field.name.toLowerCase()}` : `Add ${field.name.toLowerCase()}`} /></label>)}{error && <p className="form-error">{error}</p>}<div className="modal-actions"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button type="submit">{person ? 'Save changes' : 'Add person'}</Button></div></form></div>; }
function CustomFieldInput({ field, value, onChange }) {
  if (field.type === 'URL') return <input type="url" value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder="https://..." />;
  if (field.type === 'Date') return <input type="date" value={value || ''} onChange={(event) => onChange(event.target.value)} />;
  if (field.type === 'Number') return <input type="number" value={value || ''} onChange={(event) => onChange(event.target.value)} />;
  if (field.type === 'Checkbox') return <input className="field-checkbox-input" type="checkbox" checked={/^(true|yes|1|checked)$/i.test(String(value || ''))} onChange={(event) => onChange(event.target.checked ? 'true' : 'false')} />;
  if (field.type === 'Dropdown') return <SelectMenu ariaLabel={field.name} value={value || ''} onChange={onChange} options={[{ value: '', label: `Choose ${field.name.toLowerCase()}` }, ...(field.options || []).map((option) => ({ value: option, label: option }))]} />;
  if (field.type === 'Multi-select') return <input value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder="e.g. Events, Creatives" />;
  return <input value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={`Add ${field.name.toLowerCase()}`} />;
}

function PersonForm({ person, fields, onCancel, onSave }) {
  const [form, setForm] = useState(person || { id: `p-${Date.now()}`, name: '', birthday: '', notes: '', fields: {}, createdAt: isoToday }); const [error, setError] = useState('');
  const setValue = (key, value) => setForm((current) => ({ ...current, [key]: value })); const setField = (key, value) => setForm((current) => ({ ...current, fields: { ...current.fields, [key]: value } }));
  const submit = (event) => { event.preventDefault(); if (!form.name.trim()) { setError('Add a name to continue.'); return; } if (!/^\d{4}-\d{2}-\d{2}$/.test(form.birthday)) { setError('Choose a valid birthday.'); return; } onSave({ ...form, name: form.name.trim() }); };
  return <div className="modal-scrim"><form className="modal form-modal" onSubmit={submit}><div className="modal-heading"><div><p className="eyebrow">{person ? 'Update details' : 'New person'}</p><h2>{person ? 'Edit person' : 'Add a person'}</h2></div><button type="button" className="icon-button" onClick={onCancel} aria-label="Close"><X size={19} /></button></div><label>Full name<input autoFocus value={form.name} onChange={(event) => setValue('name', event.target.value)} placeholder="e.g. Maria Santos" /></label><label>Birthday<input type="date" value={form.birthday} onChange={(event) => setValue('birthday', event.target.value)} /></label><label>Notes <span className="optional">Optional</span><textarea rows="3" value={form.notes} onChange={(event) => setValue('notes', event.target.value)} placeholder="Anything worth remembering..." /></label>{fields.map((field) => <label className={field.type === 'Checkbox' ? 'checkbox-field-label' : ''} key={field.id}>{field.name}<CustomFieldInput field={field} value={form.fields?.[field.name]} onChange={(value) => setField(field.name, value)} /></label>)}{error && <p className="form-error">{error}</p>}<div className="modal-actions"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button type="submit">{person ? 'Save changes' : 'Add person'}</Button></div></form></div>;
}

function ConfirmDelete({ person, onCancel, onConfirm }) { return <div className="modal-scrim"><div className="modal confirm-modal"><span className="confirm-icon"><Trash2 size={20} /></span><h2>Delete {person.name}?</h2><p>This will permanently remove this person and their notes from this device.</p><div className="modal-actions"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button variant="danger" onClick={onConfirm}>Delete person</Button></div></div></div>; }
function EmptyState({ message = 'No birthdays yet', description = 'Add your first person to start organizing birthdays.', onAdd, compact }) { return <div className={`empty-state ${compact ? 'compact' : ''}`}><span className="empty-icon"><Gift size={22} /></span><h3>{message}</h3><p>{description}</p>{onAdd && <Button icon={Plus} onClick={onAdd}>Add person</Button>}</div>; }

function OldFields({ data, setData, notify }) { const [editing, setEditing] = useState(null); const [name, setName] = useState(''); const [type, setType] = useState('Text'); const [options, setOptions] = useState(''); const save = () => { if (!name.trim()) return; const field = { id: editing?.id || `f-${Date.now()}`, name: name.trim(), type, options: options.split(',').map((item) => item.trim()).filter(Boolean) }; setData((current) => ({ ...current, fields: editing ? current.fields.map((item) => item.id === field.id ? field : item) : [...current.fields, field] })); setName(''); setType('Text'); setOptions(''); setEditing(null); notify(editing ? 'Custom field updated.' : 'Custom field created.'); }; const edit = (field) => { setEditing(field); setName(field.name); setType(field.type); setOptions(field.options.join(', ')); }; const remove = (field) => { if (!window.confirm(`Archive ${field.name}? Existing values will remain on people.`)) return; setData((current) => ({ ...current, fields: current.fields.filter((item) => item.id !== field.id) })); notify('Custom field archived.'); }; return <><PageHeader eyebrow="Make it yours" title="Custom fields" description="Add the details that make your directory useful to your organization." /><div className="fields-layout"><div className="field-list panel"><div className="panel-heading"><div><p className="eyebrow">Your fields</p><h2>{data.fields.length} active fields</h2></div><SlidersHorizontal size={19} /></div>{data.fields.map((field) => <div className="field-row" key={field.id}><span className="field-type">{field.type.charAt(0)}</span><span><strong>{field.name}</strong><small>{field.type} · {data.people.filter((person) => person.fields?.[field.name]).length} people using this</small></span><button className="icon-button" onClick={() => edit(field)} aria-label={`Edit ${field.name}`}><Edit3 size={16} /></button><button className="icon-button danger" onClick={() => remove(field)} aria-label={`Archive ${field.name}`}><Trash2 size={16} /></button></div>)}</div><div className="field-form panel"><p className="eyebrow">{editing ? 'Edit field' : 'New field'}</p><h2>{editing ? 'Update a detail' : 'What should you track?'}</h2><label>Field name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Committee" /></label><label>Field type<select value={type} onChange={(event) => setType(event.target.value)}><option>Text</option><option>Number</option><option>Date</option><option>Checkbox</option><option>Dropdown</option><option>Multi-select</option><option>URL</option></select></label>{['Dropdown', 'Multi-select'].includes(type) && <label>Options <span className="optional">Comma separated</span><input value={options} onChange={(event) => setOptions(event.target.value)} placeholder="Executive, Creatives, Events" /></label>}<Button icon={Plus} onClick={save}>{editing ? 'Save field' : 'Add field'}</Button>{editing && <button className="text-button cancel-edit" onClick={() => { setEditing(null); setName(''); setOptions(''); }}>Cancel editing</button>}</div></div></>; }

function LegacySettingsView({ data, setData, onImport, onExport, notify }) { const fileRef = useRef(null); return <><PageHeader eyebrow="The essentials" title="Settings" description="A few quiet controls for your workspace." /><div className="settings-stack"><div className="settings-section panel"><div><p className="eyebrow">Organization</p><h2>Workspace details</h2><p className="muted">This information stays on this device.</p></div><label>Organization name<input value={data.organization.name} onChange={(event) => setData((current) => ({ ...current, organization: { ...current.organization, name: event.target.value } }))} /></label><label>Timezone<select value={data.organization.timezone} onChange={(event) => setData((current) => ({ ...current, organization: { ...current.organization, timezone: event.target.value } }))}><option>Asia/Manila</option><option>Asia/Singapore</option><option>America/New_York</option><option>Europe/London</option></select></label></div><div className="settings-section panel"><div><p className="eyebrow">Data management</p><h2>Bring it with you</h2><p className="muted">Import a CSV or take a backup of the current view.</p></div><div className="settings-actions"><Button icon={Upload} variant="secondary" onClick={() => fileRef.current?.click()}>Import CSV</Button><input ref={fileRef} type="file" accept=".csv" hidden onChange={(event) => event.target.files[0] && onImport(event.target.files[0])} /><Button icon={Download} variant="secondary" onClick={onExport}>Export CSV</Button><Button icon={Trash2} variant="danger" onClick={() => { if (window.confirm('Clear all local data and return to the starter workspace?')) { localStorage.removeItem(STORAGE_KEY); setData(starterData); notify('Workspace reset.'); } }}>Reset workspace</Button></div></div></div></>; }

function LegacyFields({ data, setData, notify }) {
  const [editing, setEditing] = useState(null); const [name, setName] = useState(''); const [type, setType] = useState('Text'); const [options, setOptions] = useState(''); const [showOnBirthdays, setShowOnBirthdays] = useState(false);
  const types = ['Text', 'Number', 'Date', 'Checkbox', 'Dropdown', 'Multi-select', 'URL'].map((value) => ({ value, label: value }));
  const reset = () => { setEditing(null); setName(''); setType('Text'); setOptions(''); setShowOnBirthdays(false); };
  const save = () => { if (!name.trim()) return; const field = { id: editing?.id || `f-${Date.now()}`, name: name.trim(), type, options: options.split(',').map((item) => item.trim()).filter(Boolean), showOnBirthdays }; setData((current) => ({ ...current, fields: editing ? current.fields.map((item) => item.id === field.id ? field : item) : [...current.fields, field] })); notify(editing ? 'Custom field updated.' : 'Custom field created.'); reset(); };
  const edit = (field) => { setEditing(field); setName(field.name); setType(field.type); setOptions(field.options.join(', ')); setShowOnBirthdays(Boolean(field.showOnBirthdays)); };
  const remove = (field) => { if (!window.confirm(`Archive ${field.name}? Existing values will remain on people.`)) return; setData((current) => ({ ...current, fields: current.fields.filter((item) => item.id !== field.id) })); notify('Custom field archived.'); };
  return <><PageHeader eyebrow="Make it yours" title="Custom fields" description="Add the details that make your directory useful to your organization." /><div className="fields-layout"><div className="field-list panel"><div className="panel-heading"><div><p className="eyebrow">Your fields</p><h2>{data.fields.length} active fields</h2></div><SlidersHorizontal size={19} /></div>{data.fields.map((field) => <div className="field-row" key={field.id}><span className="field-type">{field.type.charAt(0)}</span><span><strong>{field.name}</strong><small>{field.type} · {data.people.filter((person) => person.fields?.[field.name]).length} people using this</small></span><button className="icon-button" onClick={() => edit(field)} aria-label={`Edit ${field.name}`}><Edit3 size={16} /></button><button className="icon-button danger" onClick={() => remove(field)} aria-label={`Archive ${field.name}`}><Trash2 size={16} /></button></div>)}</div><div className="field-form panel"><p className="eyebrow">{editing ? 'Edit field' : 'New field'}</p><h2>{editing ? 'Update a detail' : 'What should you track?'}</h2><label>Field name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Committee" /></label><label>Field type<SelectMenu ariaLabel="Field type" value={type} onChange={setType} options={types} /></label>{['Dropdown', 'Multi-select'].includes(type) && <label>Options <span className="optional">Comma separated</span><input value={options} onChange={(event) => setOptions(event.target.value)} placeholder="Executive, Creatives, Events" /></label>}<label className="birthday-visibility-toggle"><span><strong>Show on Birthdays</strong><small>Add this field as a quick-action column.</small></span><input type="checkbox" checked={showOnBirthdays} onChange={(event) => setShowOnBirthdays(event.target.checked)} /><i /></label><Button icon={editing ? Check : Plus} onClick={save}>{editing ? 'Save field' : 'Add field'}</Button>{editing && <button className="text-button cancel-edit" onClick={reset}>Cancel editing</button>}</div></div></>;
}

function Fields({ data, setData, notify }) {
  return <LegacyFields data={data} setData={setData} notify={notify} />;
}

function SettingsView({ data, setData, onImport, onExport, notify }) {
  const fileRef = useRef(null);
  const updateOrganization = (key, value) => setData((current) => ({ ...current, organization: { ...current.organization, [key]: value } }));
  return <><PageHeader eyebrow="The essentials" title="Settings" description="A few quiet controls for your workspace." /><div className="settings-stack"><div className="settings-section panel"><div><p className="eyebrow">Organization</p><h2>Workspace details</h2><p className="muted">This information stays on this device.</p></div><label>Organization name<input value={data.organization.name} onChange={(event) => updateOrganization('name', event.target.value)} /></label><label>Timezone<SelectMenu ariaLabel="Timezone" value={data.organization.timezone} onChange={(value) => updateOrganization('timezone', value)} options={['Asia/Manila', 'Asia/Singapore', 'America/New_York', 'Europe/London'].map((value) => ({ value, label: value }))} /></label></div><div className="settings-section panel"><div><p className="eyebrow">Data management</p><h2>Bring it with you</h2><p className="muted">Import a CSV or XLSX workbook, or take a backup of the current view.</p></div><div className="settings-actions"><Button icon={Upload} variant="secondary" onClick={() => fileRef.current?.click()}>Choose file</Button><input ref={fileRef} type="file" accept=".csv,.xlsx" hidden onChange={(event) => { if (event.target.files[0]) { onImport(event.target.files[0]); event.target.value = ''; } }} /><Button icon={Download} variant="secondary" onClick={onExport}>Export CSV</Button><Button icon={Trash2} variant="danger" onClick={() => { if (window.confirm('Clear all local data and return to the starter workspace?')) { localStorage.removeItem(STORAGE_KEY); setData(starterData); notify('Workspace reset.'); } }}>Reset workspace</Button></div></div></div></>;
}

export default App;
