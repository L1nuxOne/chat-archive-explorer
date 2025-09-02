window.addEventListener('error', e => { console.error('RUNTIME_ERROR', e?.message, e?.filename, e?.lineno) });
window.addEventListener('unhandledrejection', e => { console.error('UNHANDLED_REJECTION', e?.reason) });
console.log('DEV_PROBE_OK');
