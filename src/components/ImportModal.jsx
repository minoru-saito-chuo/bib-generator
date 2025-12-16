import React, { useState } from 'react';
import { X, Upload, FileText, Check, AlertCircle } from 'lucide-react';

const ImportModal = ({ isOpen, onClose, onImport }) => {
  const [activeTab, setActiveTab] = useState('file'); // 'file' or 'text'
  const [textInput, setTextInput] = useState('');
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        setTextInput(event.target.result);
        setError('');
      };
      reader.readAsText(file);
    }
  };

  // Parsing Helper for Raw TeX
  const parseRawTeX = (text) => {
    const items = [];
    const bibItemRegex = /\\bibitem\{([^}]+)\}([\s\S]*?)(?=(\\bibitem|$|\\end\{thebibliography\}))/g;

    let match;
    while ((match = bibItemRegex.exec(text)) !== null) {
      const key = match[1].trim();
      let content = match[2].trim();

      let author = '';
      let title = '';
      let year = '';
      let journal = '';
      let volume = '';
      let number = '';
      let pages = '';
      let url = '';
      let langType = 'english'; // Default guess

      // 1. Extract Title
      // Look for \textit{...} or 「...」
      const titleMatchEnglish = content.match(/\\textit\{([^}]+)\}/);
      const titleMatchJapanese = content.match(/「(.*?)」/);

      if (titleMatchJapanese) {
        title = titleMatchJapanese[1];
        langType = 'japanese';
        // Remove title from content for further processing
        content = content.replace(titleMatchJapanese[0], ' __TITLE__ ');
      } else if (titleMatchEnglish) {
        title = titleMatchEnglish[1];
        // Remove title
        content = content.replace(titleMatchEnglish[0], ' __TITLE__ ');
      }

      // 2. Extract URL
      const urlMatch = content.match(/\\url\{([^}]+)\}/);
      if (urlMatch) {
        url = urlMatch[1];
        content = content.replace(urlMatch[0], ''); // Remove URL
      }

      // 3. Extract Year
      // Look for 4 digits (19xx or 20xx)
      const yearMatch = content.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        year = yearMatch[0];
      }

      // 4. Split by __TITLE__ to find Author (before) and Journal (after)
      if (content.includes('__TITLE__')) {
        const parts = content.split('__TITLE__');
        let preTitle = parts[0].trim();
        let postTitle = parts[1] ? parts[1].trim() : '';

        // Clean Author
        // Remove trailing commas, separators
        preTitle = preTitle.replace(/,$/, '').replace(/，$/, '').trim();
        author = preTitle;

        // Clean Journal Info
        // Remove leading/trailing separators
        postTitle = postTitle.replace(/^[,，]\s*/, '').replace(/[,，.]\s*$/, '').trim();

        // Extract Vol
        const volMatch = postTitle.match(/Vol\.(\d+)/) || postTitle.match(/(\d+)巻/);
        if (volMatch) {
            volume = volMatch[1];
            if (volMatch[0].includes('巻')) langType = 'japanese';
        }

        // Extract No
        const noMatch = postTitle.match(/No\.(\d+)/) || postTitle.match(/(\d+)号/);
        if (noMatch) number = noMatch[1];

        // Extract Pages
        const pageMatch = postTitle.match(/pp\.([\d-]+)/);
        if (pageMatch) pages = pageMatch[1];

        // The rest is mostly Journal Name + Year
        let tempJournal = postTitle;
        if (year) tempJournal = tempJournal.replace(year, '');
        if (volume) tempJournal = tempJournal.replace(new RegExp(`Vol\\.${volume}|${volume}巻`), '');
        if (number) tempJournal = tempJournal.replace(new RegExp(`No\\.${number}|${number}号`), '');
        if (pages) tempJournal = tempJournal.replace(new RegExp(`pp\\.${pages}`), '');
        // Remove junk
        tempJournal = tempJournal.replace(/年/, '').replace(/[()（）]/g, '').replace(/[,，.]/g, ' ').trim();

        // Clean up double spaces
        journal = tempJournal.replace(/\s+/g, ' ');
      } else {
          // Fallback: If no title found, assume content is title or try heuristic
          if (!title) title = content;
      }

      const entryType = url ? 'web' : 'paper';

      items.push({
        id: Date.now() + Math.random(),
        entryType,
        key,
        author,
        title,
        journal,
        volume,
        number,
        pages,
        year,
        url,
        accessDate: '',
        langType
      });
    }

    return items;
  };

  const parseAndImport = () => {
    try {
      if (!textInput.trim()) {
        setError("データが空です。");
        return;
      }

      // Strategy 1: Look for embedded JSON data
      // Expected format: % JSON_DATA: [...]
      const jsonMatch = textInput.match(/% BIB_JSON_DATA: (.*)/);

      if (jsonMatch && jsonMatch[1]) {
        try {
            const jsonData = JSON.parse(jsonMatch[1]);
            if (Array.isArray(jsonData)) {
                onImport(jsonData);
                onClose();
                return;
            }
        } catch (e) {
            console.error("Failed to parse embedded JSON", e);
        }
      }

      // Strategy 2: Attempt to parse raw JSON
      try {
        const jsonData = JSON.parse(textInput);
        if (Array.isArray(jsonData)) {
          onImport(jsonData);
          onClose();
          return;
        }
      } catch {
        // Not simple JSON
      }

      // Strategy 3: Parse Raw TeX \bibitem
      const texItems = parseRawTeX(textInput);
      if (texItems.length > 0) {
        onImport(texItems);
        onClose();
        return;
      }

      // Failure
      setError("有効なデータが見つかりませんでした。\nBibGenerator形式のTeX、一般的なTeXのbibitem、またはJSONデータを使用してください。");

    } catch (e) {
      console.error(e);
      setError("インポート中にエラーが発生しました。データ形式を確認してください。");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Upload size={20} className="text-green-600" />
            データをインポート
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 shrink-0">
          <button
            onClick={() => setActiveTab('file')}
            className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${
              activeTab === 'file'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            ファイルをアップロード
          </button>
          <button
            onClick={() => setActiveTab('text')}
            className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${
              activeTab === 'text'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            テキストを貼り付け
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700 text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div className="whitespace-pre-wrap">{error}</div>
            </div>
          )}

          {activeTab === 'file' ? (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-8 bg-gray-50/50 hover:bg-gray-50 transition-colors">
              <input
                type="file"
                accept=".tex,.txt,.json,.bib"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-3 w-full h-full"
              >
                <div className="p-3 bg-white rounded-full shadow-sm">
                  <FileText size={32} className="text-blue-500" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">
                    {fileName || "クリックしてファイルを選択"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    .tex (BibGenerator形式), .json, .txt
                  </p>
                </div>
              </label>
            </div>
          ) : (
            <div className="h-full min-h-[200px]">
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="ここにファイルの内容を貼り付けてください..."
                className="w-full h-full min-h-[200px] p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm font-mono leading-relaxed resize-none"
              />
            </div>
          )}

          <div className="mt-4 text-xs text-gray-500">
            <p>※ BibGeneratorでエクスポートされた、末尾にデータタグを含むファイルを推奨します。</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 text-sm font-medium hover:bg-gray-200 rounded-lg transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={parseAndImport}
            disabled={!textInput}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check size={16} />
            インポート
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
