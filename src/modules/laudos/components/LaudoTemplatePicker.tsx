import React, { useState } from 'react';
import { Eye, FileText, Search } from 'lucide-react';
import {
  getTemplateCategories,
  LAUDO_TEMPLATES,
  type LaudoTemplate,
  type LaudoTemplateCategory,
} from '../templates/laudoTemplates';

interface LaudoTemplatePickerProps {
  onUseTemplate: (template: LaudoTemplate) => void;
  compact?: boolean;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px 8px 30px',
  border: '1px solid var(--gray-200)',
  borderRadius: 8,
  fontSize: 12,
  outline: 'none',
  background: '#fff',
};

export function LaudoTemplatePicker({ onUseTemplate, compact = false }: LaudoTemplatePickerProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<LaudoTemplateCategory | ''>('');
  const [previewTemplate, setPreviewTemplate] = useState<LaudoTemplate | null>(null);
  const categories = getTemplateCategories();

  const query = search.toLowerCase().trim();
  const filteredTemplates = LAUDO_TEMPLATES.filter(template => {
    const matchesCategory = !category || template.category === category;
    const matchesSearch = !query
      || template.title.toLowerCase().includes(query)
      || template.category.toLowerCase().includes(query)
      || template.cid?.toLowerCase().includes(query)
      || template.tags.some(tag => tag.toLowerCase().includes(query));
    return matchesCategory && matchesSearch;
  });

  return (
    <section style={{ marginTop: compact ? 10 : 16, paddingTop: compact ? 0 : 16, borderTop: compact ? 'none' : '1px solid var(--gray-100)' }}>
      {!compact && <div style={{ marginBottom: 10 }}>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--gray-800)', margin: 0 }}>Laudos pre-prontos</h3>
        <p style={{ fontSize: 11, color: 'var(--gray-500)', lineHeight: 1.4, margin: '4px 0 0' }}>
          Escolha um modelo para preencher rapidamente o laudo. Revise antes de finalizar.
        </p>
      </div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
        <div style={{ position: 'relative' }}>
          <label htmlFor="laudo-template-search" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Buscar modelo</label>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
          <input
            id="laudo-template-search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Buscar título, CID, especialidade..."
            style={inputStyle}
          />
        </div>

        <div>
          <label htmlFor="laudo-template-category" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Filtrar categoria</label>
          <select
            id="laudo-template-category"
            value={category}
            onChange={event => setCategory(event.target.value as LaudoTemplateCategory | '')}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 12, background: '#fff', outline: 'none' }}
          >
            <option value="">Todas as categorias</option>
            {categories.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 7 : 10, maxHeight: compact ? 280 : undefined, overflow: compact ? 'auto' : undefined, paddingRight: compact ? 2 : 0 }}>
        {filteredTemplates.map(template => (
          <article key={template.id} style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: compact ? 9 : 12, boxShadow: compact ? 'none' : '0 1px 5px rgba(0,0,0,0.06)', padding: compact ? 9 : 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
              <h4 style={{ fontSize: 12, lineHeight: 1.25, fontWeight: 850, color: 'var(--gray-800)', margin: 0 }}>{template.title}</h4>
              {template.cid && (
                <span style={{ flexShrink: 0, background: '#ede9fe', color: '#6d28d9', borderRadius: 999, padding: '3px 7px', fontSize: 10, fontWeight: 850 }}>
                  CID {template.cid}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: compact ? 6 : 8 }}>
              <span style={{ background: 'var(--gray-100)', color: 'var(--gray-600)', borderRadius: 999, padding: '3px 7px', fontSize: 10, fontWeight: 750 }}>{template.category}</span>
              {template.tags.slice(0, 3).map(tag => (
                <span key={tag} style={{ background: 'var(--mint)', color: 'var(--primary)', borderRadius: 999, padding: '3px 7px', fontSize: 10, fontWeight: 750 }}>{tag}</span>
              ))}
            </div>

            <p style={{ fontSize: 11, color: 'var(--gray-500)', lineHeight: 1.4, margin: compact ? '7px 0 8px' : '9px 0 10px', display: '-webkit-box', WebkitLineClamp: compact ? 1 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {template.preview}
            </p>

            <div style={{ display: 'flex', gap: 7 }}>
              <button type="button" onClick={() => onUseTemplate(template)}
                style={{ flex: 1, border: 'none', borderRadius: 8, background: 'var(--primary)', color: '#fff', padding: '8px 10px', fontSize: 11, fontWeight: 850, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <FileText size={12} /> Usar modelo
              </button>
              <button type="button" onClick={() => setPreviewTemplate(template)}
                style={{ width: 34, border: '1px solid var(--gray-200)', borderRadius: 8, background: '#fff', color: 'var(--gray-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Visualizar modelo">
                <Eye size={13} />
              </button>
            </div>
          </article>
        ))}

        {filteredTemplates.length === 0 && (
          <div style={{ border: '1px dashed var(--gray-200)', borderRadius: 12, padding: 14, textAlign: 'center', color: 'var(--gray-400)', fontSize: 12 }}>
            Nenhum modelo encontrado
          </div>
        )}
      </div>

      {previewTemplate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', width: 'min(620px, calc(100vw - 32px))', maxHeight: 'calc(100dvh - 32px)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 850, color: 'var(--gray-800)', margin: 0 }}>{previewTemplate.title}</h3>
                <p style={{ fontSize: 11, color: 'var(--gray-500)', margin: '3px 0 0' }}>{previewTemplate.category}</p>
              </div>
              <button type="button" onClick={() => setPreviewTemplate(null)} style={{ border: 'none', background: 'var(--gray-100)', borderRadius: 8, width: 30, height: 30, cursor: 'pointer' }}>x</button>
            </div>
            <pre style={{ margin: 0, padding: 18, whiteSpace: 'pre-wrap', fontFamily: 'Arial, sans-serif', fontSize: 13, lineHeight: 1.6, color: 'var(--gray-700)', overflow: 'auto', maxHeight: '65dvh' }}>
              {previewTemplate.body}
            </pre>
            <div style={{ padding: 14, borderTop: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setPreviewTemplate(null)} style={{ border: '1px solid var(--gray-200)', background: '#fff', borderRadius: 9, padding: '8px 14px', fontSize: 12, fontWeight: 750, cursor: 'pointer' }}>Fechar</button>
              <button type="button" onClick={() => { onUseTemplate(previewTemplate); setPreviewTemplate(null); }} style={{ border: 'none', background: 'var(--primary)', color: '#fff', borderRadius: 9, padding: '8px 14px', fontSize: 12, fontWeight: 850, cursor: 'pointer' }}>Usar modelo</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
