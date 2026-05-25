/** Per-type background fill color (solid tag). */
export const TYPE_COLORS: Record<string, string> = {
  root: '#636e72',
  feature: '#7b8cf0',
  task: '#e1a82a',
  subtask: '#5a9e6f',
  test_suite: '#a55db5',
  test_case: '#5ea3b5',
  bug: '#e07070',
  link: '#5e81b5',
};

/** Per-type display label. */
export const TYPE_LABELS: Record<string, string> = {
  root: 'root',
  feature: 'feat',
  task: 'task',
  subtask: 'sub',
  test_suite: 'suite',
  test_case: 'case',
  bug: 'bug',
  link: 'link',
};

/** Per-status text color. */
export const STATUS_COLORS: Record<string, string> = {
  done: '#00b894',
  in_progress: '#fdcb6e',
  pending: '#b2bec3',
  pass: '#00b894',
  fail: '#e17055',
  blocked: '#e17055',
};

/** Section keyword → border color. */
export const SECTION_COLORS: Record<string, string> = {
  Code: '#7b8cf0',
  Criteria: '#00b894',
  Issues: '#e07070',
  Notes: '#b2bec3',
};
export const SECTION_DEFAULT_COLOR = '#8888b0';

/** AI hint breathing dot color. */
export const AI_HINT_DOT_COLOR = '#7b8cf0';
