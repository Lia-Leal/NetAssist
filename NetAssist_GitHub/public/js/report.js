
(async () => {
  const user = await NA.init({ active: 'history', require: true });
  if (!user) return;

  const id = new URLSearchParams(location.search).get('id');
  const root = NA.$('#rep');

  try {
    const d = await NA.api(
      'GET',
      '/api/history/' + encodeURIComponent(id)
    );

    // Preview button and existing Run Test Again button
    const actions = `
      <span class="row no-print">
        <button class="btn btn-ghost btn-sm" id="preview-report">
          ${NA.icon('eye')} Preview Report
        </button>

        <a class="btn btn-primary btn-sm"
          href="/diagnose?problem=${encodeURIComponent(d.problem)}&retest=${d.id}">
          ${NA.icon('refresh')} Run test again
        </a>
      </span>
    `;

    // Display the original diagnostic report
    NA.renderReport(root, d.report, {
      date: NA.when(d.created_at),
      previous: d.previous,
      id: d.id,
      created: d.created_at,
      actions
    });

    // Create the report preview modal
    const modal = document.createElement('div');
    modal.id = 'report-preview-modal';
    modal.className = 'report-preview-modal no-print';

    modal.innerHTML = `
      <div class="report-preview-container">

        <div class="report-preview-header">
          <div>
            <span class="preview-label">NETASSIST DOCUMENT</span>
            <h2>Diagnostic Report Preview</h2>
            <p>Review your report before printing or saving.</p>
          </div>

          <button type="button"
            class="preview-close"
            id="close-report-preview"
            aria-label="Close preview">
            &times;
          </button>
        </div>

        <div class="report-preview-body" id="preview-report-content">
        </div>

        <div class="report-preview-footer">
          <button class="btn btn-ghost" id="back-report">
            Back to report
          </button>

          <button class="btn btn-primary" id="print-preview-report">
            ${NA.icon('print')} Print / Save as PDF
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(modal);

    const previewButton = NA.$('#preview-report');
    const previewContent = NA.$('#preview-report-content');

    // Open preview and copy the complete report
    previewButton.onclick = () => {
      previewContent.innerHTML = root.innerHTML;

      // Remove buttons and other non-printable controls
      previewContent.querySelectorAll('.no-print').forEach(el => {
        el.remove();
      });

      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    };

    // Close preview
    const closePreview = () => {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    };

    NA.$('#close-report-preview').onclick = closePreview;
    NA.$('#back-report').onclick = closePreview;

    // Close when clicking outside the preview container
    modal.onclick = (e) => {
      if (e.target === modal) {
        closePreview();
      }
    };

    // Print the original report, not the preview modal
    NA.$('#print-preview-report').onclick = () => {
      closePreview();

      document.body.classList.add('printing-report');

      window.print();
    };

    // Restore the page after printing
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('printing-report');
    });

  } catch (e) {
    root.innerHTML = `
      <div class="card empty">
        <p>
          <b>
            ${e.status === 404
              ? 'That report was not found.'
              : NA.esc(e.message)}
          </b>
        </p>

        <a class="btn btn-primary" href="/history">
          Back to history
        </a>
      </div>
    `;
  }
})();
