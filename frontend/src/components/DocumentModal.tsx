import React, { useState, useEffect } from 'react';
import { X, FileText } from 'lucide-react';
import { DocumentNote, Vehicle } from '../types';

interface DocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<DocumentNote>) => Promise<void>;
  doc?: DocumentNote | null;
  vehicle: Vehicle;
}

export const DocumentModal: React.FC<DocumentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  doc,
  vehicle,
}) => {
  const [formData, setFormData] = useState({
    title: '',
    doc_type: 'insurance',
    document_number: '',
    issue_date: new Date().toISOString().split('T')[0],
    expiration_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    file_url: '',
    notes: '',
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (doc) {
      setFormData({
        title: doc.title,
        doc_type: doc.doc_type,
        document_number: doc.document_number || '',
        issue_date: doc.issue_date ? doc.issue_date.split('T')[0] : '',
        expiration_date: doc.expiration_date ? doc.expiration_date.split('T')[0] : '',
        file_url: doc.file_url || '',
        notes: doc.notes || '',
      });
    } else {
      setFormData({
        title: 'Полис ОСАГО',
        doc_type: 'insurance',
        document_number: '',
        issue_date: new Date().toISOString().split('T')[0],
        expiration_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        file_url: '',
        notes: '',
      });
    }
  }, [doc, isOpen, vehicle]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        ...formData,
        issue_date: formData.issue_date ? new Date(formData.issue_date).toISOString() : undefined,
        expiration_date: formData.expiration_date ? new Date(formData.expiration_date).toISOString() : undefined,
      });
      onClose();
    } catch (err) {
      alert('Ошибка при сохранении документа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-dark-850 border border-dark-750 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-750">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-brand-400" />
            <h2 className="text-base font-bold text-white">
              {doc ? 'Редактировать документ' : 'Добавить документ / Срок'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Тип документа *
              </label>
              <select
                value={formData.doc_type}
                onChange={(e) => setFormData({ ...formData, doc_type: e.target.value })}
                className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              >
                <option value="insurance">Страховка (ОСАГО / КАСКО)</option>
                <option value="inspection">Техосмотр / Диагност. карта</option>
                <option value="registration">СТС / ПТС</option>
                <option value="warranty">Гарантия / Сервисный договор</option>
                <option value="note">Заметка / Памятка</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Номер документа
              </label>
              <input
                type="text"
                placeholder="ХХХ 0123456789"
                value={formData.document_number}
                onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Название / Страховая компания *
            </label>
            <input
              type="text"
              required
              placeholder="ОСАГО Альфастрахование, КАСКО Ингосстрах..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Дата выдачи / Начало действия
              </label>
              <input
                type="date"
                value={formData.issue_date}
                onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-rose-400 mb-1">
                Дата окончания (дедлайн) *
              </label>
              <input
                type="date"
                required
                value={formData.expiration_date}
                onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Заметки / Контакты агента
            </label>
            <textarea
              rows={2}
              placeholder="Сумма полиса 8 500 руб, агент +7(999)..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-dark-900 border border-dark-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="pt-3 border-t border-dark-750 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-dark-800 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg text-xs font-semibold bg-brand-500 hover:bg-brand-600 active:scale-95 text-white transition-all shadow-md shadow-brand-500/20 disabled:opacity-50"
            >
              {loading ? 'Сохранение...' : doc ? 'Сохранить изменения' : 'Добавить документ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
