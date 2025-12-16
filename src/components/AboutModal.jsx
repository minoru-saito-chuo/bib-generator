import React from 'react';
import { X, Github, Info } from 'lucide-react';

const AboutModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Info size={20} className="text-blue-500" />
            このアプリについて
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">BibGenerator</h1>
            <p className="text-sm text-gray-500">Simple Bibliography Manager for LaTeX</p>
          </div>

          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="font-medium">バージョン</span>
              <span>1.1.0</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="font-medium">開発者</span>
              <span>BibGenerator Dev Team</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="font-medium">ライセンス</span>
              <span>MIT License</span>
            </div>
          </div>

          <div className="pt-4 text-xs text-gray-400 text-center leading-relaxed">
            <p>このツールはブラウザ上で動作し、サーバーにデータを送信しません。</p>
            <p>データはCookieまたはローカルに保存されます。</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 flex justify-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors shadow-sm"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

export default AboutModal;
