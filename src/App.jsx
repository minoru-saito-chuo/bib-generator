import React, { useState, useEffect, useRef } from 'react';
import { Copy, Plus, Trash2, FileText, List, Check, BookOpen, Globe, Settings, Monitor, Link, ChevronRight, GripVertical, Save, AlertTriangle, Download, Upload, Info } from 'lucide-react';
import AboutModal from './components/AboutModal';
import ImportModal from './components/ImportModal';

// UI Components mimicking macOS - Moved outside to fix lint error
const SegmentedControl = ({ options, value, onChange }) => (
  <div className="flex bg-gray-200/80 p-0.5 rounded-lg select-none inline-flex">
    {options.map((opt) => (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
        className={`
          px-3 py-1 text-xs font-medium rounded-[6px] transition-all
          ${value === opt.value
            ? 'bg-white text-black shadow-sm'
            : 'text-gray-500 hover:text-gray-700'}
        `}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

const App = () => {
  // State for form inputs
  const [formData, setFormData] = useState({
    entryType: 'paper', // 'paper' or 'web'
    key: '',
    author: '',
    title: '',
    journal: '',      // For Paper: Journal Name, For Web: Site Name
    volume: '',
    number: '',
    pages: '',
    year: '',
    url: '',          // For Web
    accessDate: '',   // For Web
    langType: 'japanese', // Default changed to 'japanese' per Request ④
  });

  // State for the list of items
  const [items, setItems] = useState([]);

  // State for settings
  const [mode, setMode] = useState('full'); // 'full' or 'item'
  const [formatStyle, setFormatStyle] = useState('standard'); // 'standard' or 'author_year'
  const [copied, setCopied] = useState(false);

  // Modals state
  const [showAbout, setShowAbout] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Refs for Drag and Drop
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  // --- Cookie Logic ---

  // Load from cookie on mount
  useEffect(() => {
    const getCookie = (name) => {
      const nameEQ = name + "=";
      const ca = document.cookie.split(';');
      for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
      }
      return null;
    };

    const savedData = getCookie('bib_items');
    if (savedData) {
      try {
        const parsedItems = JSON.parse(savedData);
        if (Array.isArray(parsedItems) && parsedItems.length > 0) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setItems(parsedItems);
          console.log("Loaded from Cookie:", parsedItems.length, "items");
        }
      } catch (e) {
        console.error("Failed to parse cookie data", e);
      }
    }
  }, []);

  const saveToCookie = () => {
    try {
      if (items.length === 0) {
        alert("保存するアイテムがありません。");
        return;
      }

      const data = JSON.stringify(items);
      // Simple size check (Cookie limit is usually around 4KB)
      const size = new Blob([encodeURIComponent(data)]).size;

      if (size > 3800) { // Safety margin for 4096 bytes
        alert(`データサイズが大きすぎます(${Math.round(size / 1024)}KB)。\nCookieの容量制限(約4KB)を超えるため保存できませんでした。\nアイテム数を減らしてください。`);
        return;
      }

      // Set cookie for 30 days
      const days = 30;
      const date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      const expires = "; expires=" + date.toUTCString();

      document.cookie = "bib_items=" + encodeURIComponent(data) + expires + "; path=/";

      alert("✅ 一時保存しました。\n\n【注意】\nCookieを使用しているため、以下の可能性があります：\n・ブラウザのキャッシュクリアでデータが消える\n・有効期限（30日）経過後に消える\n・容量制限により大量のデータは保存できない\n\n重要なデータは必ずLaTeXファイル等にコピーして保存してください。");

    } catch (e) {
      console.error(e);
      alert("保存中にエラーが発生しました。");
    }
  };

  // --- End Cookie Logic ---

  // --- Export Logic (Request ②) ---
  const handleExport = () => {
    if (items.length === 0) {
      alert("エクスポートするデータがありません。");
      return;
    }

    const content = generateOutput();
    // Embed JSON data for lossless import
    const jsonData = JSON.stringify(items);
    const fileContent = `${content}\n\n% ==========================================\n% BIB_JSON_DATA: ${jsonData}\n% ==========================================\n`;

    const blob = new Blob([fileContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'References.tex';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- Import Logic (Request ③) ---
  const handleImport = (importedItems) => {
    if (confirm('現在のリストを上書きしますか？\n（キャンセルを選択すると現在のリストに追加します）')) {
      setItems(importedItems);
    } else {
      // Append logic: Avoid duplicate IDs
      const newItems = importedItems.map(item => ({...item, id: Date.now() + Math.random()}));
      setItems(prev => [...prev, ...newItems]);
    }
  };


  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Helper to format a single item
  const formatItem = (item) => {
    const {
      entryType, key, author, title, journal,
      volume, number, pages, year,
      url, accessDate, langType
    } = item;

    // Basic validation
    if (!key && !author && !title) return '';

    let text = `\\bibitem{${key || 'key'}} `;
    const isJp = langType === 'japanese';
    const isWeb = entryType === 'web';

    // --- Component Builders ---

    const buildAuthor = () => {
      return author ? author : (isJp ? '著者不明' : 'Anon');
    };

    const buildYear = (withParens = false) => {
      if (!year) return '';
      if (formatStyle === 'author_year' && withParens) {
        return ` (${year})`;
      }
      return isJp ? `${year}年` : `${year}`;
    };

    const buildTitle = () => {
      if (!title) return '';
      if (isJp) return `「${title}」`;
      return `\\textit{${title}}`;
    };

    const buildJournalInfo = () => {
      let parts = [];
      if (journal) parts.push(journal);

      if (!isWeb) {
        if (volume) parts.push(isJp ? `Vol.${volume}` : `Vol.${volume}`);
        if (isJp && volume) {
          parts = [];
          if (journal) parts.push(journal);
          if (volume) parts.push(`${volume}巻`);
          if (number) parts.push(`${number}号`);
          if (pages) parts.push(`pp.${pages}`);
        } else {
          if (number) parts.push(`No.${number}`);
          if (pages) parts.push(`pp.${pages}`);
        }
      }

      return parts.join(isJp ? '，' : ', ');
    };

    const buildWebExtra = () => {
      if (!isWeb) return '';
      let str = '';
      if (url) str += isJp ? `，\\url{${url}}` : `, \\url{${url}}`;
      if (accessDate) str += isJp ? `（閲覧日：${accessDate}）` : ` [Accessed: ${accessDate}]`;
      return str;
    };

    // --- Assembling based on Style ---
    if (formatStyle === 'standard') {
      text += buildAuthor();
      text += isJp ? '，' : ', ';
      text += buildTitle();
      text += isJp ? '，' : ', ';

      const info = buildJournalInfo();
      if (info) text += info;

      if (year) {
        text += (info ? (isJp ? '，' : ', ') : '') + buildYear();
      }

      text += buildWebExtra();
      text += isJp ? '．' : '.';

    } else if (formatStyle === 'author_year') {
      text += buildAuthor();
      text += buildYear(true);
      text += isJp ? '：' : ': ';
      text += buildTitle();
      text += isJp ? '，' : ', ';

      const info = buildJournalInfo();
      if (info) text += info;

      text += buildWebExtra();
      text += isJp ? '．' : '.';
    }

    return text;
  };

  const addItem = () => {
    if (!formData.key && !formData.title) return;
    setItems(prev => [...prev, { ...formData, id: Date.now() }]);
    setFormData(prev => ({
      ...prev,
      key: '',
      author: '',
      title: '',
      journal: '',
      volume: '',
      number: '',
      pages: '',
      year: '',
      url: '',
      accessDate: '',
    }));
  };

  const removeItem = (id) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const clearAll = () => {
    if (confirm('リストをすべて消去しますか？\n(Cookieに保存されたデータは上書きするまで残ります)')) {
      setItems([]);
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e, position) => {
    dragItem.current = position;
  };

  const handleDragEnter = (e, position) => {
    dragOverItem.current = position;

    // Sort logic
    const _items = [...items];
    const dragItemContent = _items[dragItem.current];
    _items.splice(dragItem.current, 1);
    _items.splice(dragOverItem.current, 0, dragItemContent);

    dragItem.current = position;
    setItems(_items);
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // Necessary for onDrop to trigger (though we use dragEnter for sorting)
  };

  const generateOutput = () => {
    const itemStrings = items.map(formatItem).join('\n\n');
    const hasWebUrl = items.some(item => item.entryType === 'web' && item.url);
    const warning = hasWebUrl
      ? "% メインファイルのプリアンブルに\n% \\usepackage{url}\n% を挿入してください．\n\n"
      : "";

    if (mode === 'full') {
      return `${warning}\\begin{thebibliography}{99}\n\n${itemStrings}\n\n\\end{thebibliography}`;
    } else {
      return `${warning}${itemStrings}`;
    }
  };

  const copyToClipboard = () => {
    const text = generateOutput();
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed', err);
    }
    document.body.removeChild(textArea);
  };

  return (
    // Modified layout for Responsive (Request ①)
    <div className="h-screen w-full bg-[#F5F5F7] flex flex-col font-sans antialiased text-gray-900 overflow-hidden">

      <AboutModal isOpen={showAbout} onClose={() => setShowAbout(false)} />
      <ImportModal isOpen={showImport} onClose={() => setShowImport(false)} onImport={handleImport} />

      {/* Header / Toolbar */}
      <header className="h-14 bg-[#F5F5F7] border-b border-gray-300 flex items-center justify-between px-4 shrink-0 z-10">
        <div className="flex items-center gap-4 lg:gap-6">
          <h1 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <BookOpen size={20} className="text-gray-500" />
            <span className="hidden sm:inline">BibGenerator</span>
            <span className="sm:hidden">BibGen</span>
          </h1>

          <div className="h-6 w-px bg-gray-300 hidden md:block"></div>

          <div className="flex items-center gap-2 md:gap-4 overflow-x-auto no-scrollbar">
            <SegmentedControl
              options={[
                { label: 'Paper', value: 'paper' },
                { label: 'Web', value: 'web' }
              ]}
              value={formData.entryType}
              onChange={(val) => setFormData({ ...formData, entryType: val })}
            />
            {/* Hidden on very small screens if needed, or wrap */}
            <div className="hidden sm:block">
              <SegmentedControl
                options={[
                  { label: 'English', value: 'english' },
                  { label: '日本語', value: 'japanese' }
                ]}
                value={formData.langType}
                onChange={(val) => setFormData({ ...formData, langType: val })}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* New Import Button */}
          <button
            onClick={() => setShowImport(true)}
            className="p-1.5 text-gray-500 hover:bg-gray-200 rounded transition-colors"
            title="Import Data"
          >
            <Upload size={18} />
          </button>

          {/* New About Button */}
          <button
            onClick={() => setShowAbout(true)}
            className="p-1.5 text-gray-500 hover:bg-gray-200 rounded transition-colors"
            title="About"
          >
            <Info size={18} />
          </button>

          <div className="hidden md:flex items-center gap-2 mr-2">
            <button
              onClick={saveToCookie}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors active:scale-95"
              title="Cookieに一時保存します"
            >
              <Save size={14} className="text-gray-500" />
              Save
            </button>
          </div>

          <div className="h-4 w-px bg-gray-300 mx-1 hidden md:block"></div>

          <select
            value={formatStyle}
            onChange={(e) => setFormatStyle(e.target.value)}
            className="bg-white border border-gray-300 text-gray-700 text-xs rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm cursor-pointer w-24 hidden sm:block"
          >
            <option value="standard">Standard</option>
            <option value="author_year">Author-Year</option>
          </select>
        </div>
      </header>

      {/* Main Content Area (3 Columns) - Responsive Layout Change */}
      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">

        {/* Column 1: Sidebar (List) */}
        <div className="w-full lg:w-64 bg-[#F2F3F5] border-b lg:border-b-0 lg:border-r border-gray-300 flex flex-col shrink-0 lg:h-full h-1/4 min-h-[150px]">
          <div className="p-3 border-b border-gray-200/50 flex justify-between items-center bg-[#F2F3F5] sticky top-0 z-10">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider pl-2">Library</span>
            <span className="text-[10px] text-gray-400 font-mono">{items.length} items</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {items.length === 0 ? (
              <div className="text-center py-6 lg:py-10 flex flex-col items-center gap-2">
                <List size={24} className="text-gray-300" />
                <p className="text-xs text-gray-400">No Items</p>
              </div>
            ) : (
              items.map((item, index) => (
                <div
                  key={item.id}
                  className="group relative px-3 py-2 rounded-md hover:bg-white transition-colors cursor-move select-none border border-transparent hover:border-gray-200/50"
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragEnter={(e) => handleDragEnter(e, index)}
                  onDragOver={handleDragOver}
                >
                  <div className="flex items-center gap-2">
                    <div className="text-gray-300 group-hover:text-gray-400 cursor-grab active:cursor-grabbing">
                      <GripVertical size={14} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.key || 'Untitled'}</p>
                      <p className="text-xs text-gray-500 truncate">{item.title}</p>
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                      className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          {/* Sidebar Footer */}
          <div className="p-2 border-t border-gray-300 bg-[#EBECEF] flex justify-between items-center">
            <button
              onClick={saveToCookie}
              className="lg:hidden p-1.5 hover:bg-black/5 rounded text-gray-500 transition-colors"
              title="Cookieに保存"
            >
              <Save size={14} />
            </button>
            {items.length > 0 && (
              <button onClick={clearAll} className="p-1.5 hover:bg-black/5 rounded text-gray-500 transition-colors ml-auto" title="Clear All">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Column 2: Editor (Form) */}
        <div className="flex-1 bg-white flex flex-col min-w-0 lg:min-w-[300px] overflow-hidden h-2/4 lg:h-full">
          <div className="p-4 lg:p-8 overflow-y-auto flex-1">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-3 sticky top-0 bg-white py-2 z-10">
              <div className={`p-2 rounded-lg ${formData.entryType === 'paper' ? 'bg-blue-50 text-blue-600' : 'bg-teal-50 text-teal-600'}`}>
                {formData.entryType === 'paper' ? <FileText size={20} /> : <Globe size={20} />}
              </div>
              Edit Properties
            </h2>

            <div className="space-y-4 lg:space-y-5 max-w-2xl pb-10">
              {/* Key Group */}
              <div className="grid grid-cols-4 gap-4 items-center">
                <label className="text-right text-xs font-medium text-gray-500 col-span-1">Key</label>
                <input
                  type="text"
                  name="key"
                  value={formData.key}
                  onChange={handleInputChange}
                  placeholder="smith2020"
                  className="col-span-3 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-shadow font-mono bg-gray-50/50"
                />
              </div>

              <div className="h-px bg-gray-100 col-span-4 my-2"></div>

              {/* Main Info Group */}
              <div className="grid grid-cols-4 gap-4 items-center">
                <label className="text-right text-xs font-medium text-gray-500 col-span-1">Author</label>
                <input
                  type="text"
                  name="author"
                  value={formData.author}
                  onChange={handleInputChange}
                  placeholder={formData.langType === 'english' ? "John Smith" : "田中 太郎"}
                  className="col-span-3 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-shadow"
                />
              </div>

              <div className="grid grid-cols-4 gap-4 items-center">
                <label className="text-right text-xs font-medium text-gray-500 col-span-1">Title</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="col-span-3 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-shadow"
                />
              </div>

              <div className="grid grid-cols-4 gap-4 items-center">
                <label className="text-right text-xs font-medium text-gray-500 col-span-1">
                  {formData.entryType === 'web' ? 'Site' : 'Journal'}
                </label>
                <input
                  type="text"
                  name="journal"
                  value={formData.journal}
                  onChange={handleInputChange}
                  className="col-span-3 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-shadow"
                />
              </div>

              {/* Conditional Fields */}
              {formData.entryType === 'paper' && (
                <>
                  <div className="grid grid-cols-4 gap-4 items-center">
                    <label className="text-right text-xs font-medium text-gray-500 col-span-1">Vol/No</label>
                    <div className="col-span-3 flex gap-2">
                      <div className="relative w-1/2">
                        <span className="absolute left-3 top-1.5 text-xs text-gray-400">Vol.</span>
                        <input
                          type="text"
                          name="volume"
                          value={formData.volume}
                          onChange={handleInputChange}
                          className="w-full rounded-md border border-gray-300 pl-10 pr-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="relative w-1/2">
                        <span className="absolute left-3 top-1.5 text-xs text-gray-400">No.</span>
                        <input
                          type="text"
                          name="number"
                          value={formData.number}
                          onChange={handleInputChange}
                          className="w-full rounded-md border border-gray-300 pl-10 pr-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 items-center">
                    <label className="text-right text-xs font-medium text-gray-500 col-span-1">Pages</label>
                    <input
                      type="text"
                      name="pages"
                      value={formData.pages}
                      onChange={handleInputChange}
                      placeholder="pp"
                      className="col-span-3 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </>
              )}

              {formData.entryType === 'web' && (
                <>
                  <div className="grid grid-cols-4 gap-4 items-center">
                    <label className="text-right text-xs font-medium text-gray-500 col-span-1">URL</label>
                    <input
                      type="text"
                      name="url"
                      value={formData.url}
                      onChange={handleInputChange}
                      placeholder="https://..."
                      className="col-span-3 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono text-blue-600"
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-4 items-center">
                    <label className="text-right text-xs font-medium text-gray-500 col-span-1">Access</label>
                    <input
                      type="text"
                      name="accessDate"
                      value={formData.accessDate}
                      onChange={handleInputChange}
                      placeholder="2024-01-01"
                      className="col-span-3 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-4 gap-4 items-center">
                <label className="text-right text-xs font-medium text-gray-500 col-span-1">Year</label>
                <input
                  type="text"
                  name="year"
                  value={formData.year}
                  onChange={handleInputChange}
                  placeholder="2024"
                  className="col-span-3 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Editor Footer (Action Bar) */}
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end shrink-0">
            <button
              onClick={addItem}
              disabled={!formData.key && !formData.title}
              className="bg-[#007AFF] hover:bg-[#0062CC] text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Plus size={16} /> Add Entry
            </button>
          </div>
        </div>

        {/* Column 3: Output (Inspector) */}
        <div className="w-full lg:w-80 bg-[#1e1e1e] flex flex-col border-t lg:border-t-0 lg:border-l border-gray-800 shrink-0 h-1/4 lg:h-full min-h-[150px]">
          <div className="h-10 bg-[#252526] border-b border-black flex items-center justify-between px-3">
            <div className="flex bg-[#333] rounded-md p-0.5">
              <button onClick={() => setMode('full')} className={`px-2 py-0.5 text-[10px] rounded-sm transition-colors ${mode === 'full' ? 'bg-[#404040] text-white' : 'text-gray-400 hover:text-gray-200'}`}>Full</button>
              <button onClick={() => setMode('item')} className={`px-2 py-0.5 text-[10px] rounded-sm transition-colors ${mode === 'item' ? 'bg-[#404040] text-white' : 'text-gray-400 hover:text-gray-200'}`}>Items</button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="text-gray-400 hover:text-white transition-colors"
                title="Export .tex"
              >
                <Download size={14} />
              </button>
              <button
                onClick={copyToClipboard}
                className="text-gray-400 hover:text-white transition-colors"
                title="Copy to Clipboard"
              >
                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
          <div className="flex-1 relative">
            <textarea
              readOnly
              value={generateOutput()}
              className="absolute inset-0 w-full h-full bg-[#1e1e1e] text-[#d4d4d4] font-mono text-xs p-4 resize-none focus:outline-none leading-relaxed"
              spellCheck="false"
            />
          </div>
        </div>

      </div>
    </div>
  );
};

export default App;
