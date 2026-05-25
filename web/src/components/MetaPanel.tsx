import { useMindsparkStore } from '../store.js';
import { updateNode, addNode, deleteNode, fetchFile } from '../api.js';

const NODE_TYPES = ['root', 'feature', 'task', 'subtask', 'test_suite', 'test_case', 'link'];
const STATUSES = ['pending', 'in_progress', 'done', 'blocked', 'pass', 'fail'];

export function MetaPanel() {
  const selectedPath = useMindsparkStore((s) => s.selectedPath);
  const file = useMindsparkStore((s) => s.file);
  const setMdContent = useMindsparkStore((s) => s.setMdContent);

  if (!selectedPath) {
    return (
      <div className="meta-panel empty">
        <p className="hint">Click a node in the mindmap to edit its properties</p>
      </div>
    );
  }

  const handleChange = async (key: string, value: unknown) => {
    await updateNode(file, selectedPath, { meta: { [key]: value } });
    const md = await fetchFile(file);
    setMdContent(md);
  };

  const handleAddChild = async () => {
    const title = prompt('New node title:');
    if (!title) return;
    await addNode(file, selectedPath, title, { type: 'task', status: 'pending' });
    const md = await fetchFile(file);
    setMdContent(md);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${selectedPath}" and all its children?`)) return;
    await deleteNode(file, selectedPath);
    const md = await fetchFile(file);
    setMdContent(md);
  };

  return (
    <div className="meta-panel">
      <h3>{selectedPath.split('/').pop()}</h3>

      <label>Type</label>
      <select defaultValue="" onChange={(e) => handleChange('type', e.target.value)}>
        <option value="">—</option>
        {NODE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>

      <label>Status</label>
      <select defaultValue="" onChange={(e) => handleChange('status', e.target.value)}>
        <option value="">—</option>
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      <label>AI Hint</label>
      <textarea
        defaultValue=""
        onChange={(e) => handleChange('ai_hint', e.target.value)}
        placeholder="Context for AI..."
        rows={3}
      />

      <label>Priority</label>
      <input
        type="number"
        defaultValue=""
        onChange={(e) => handleChange('priority', parseInt(e.target.value, 10))}
      />

      <div className="meta-actions">
        <button onClick={handleAddChild}>+ Add Child</button>
        <button className="danger" onClick={handleDelete}>Delete</button>
      </div>

      <div className="meta-info">
        <small>path: {selectedPath}</small>
      </div>
    </div>
  );
}
