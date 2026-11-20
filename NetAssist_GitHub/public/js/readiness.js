// Network Readiness Check : moved out of index.html because the page's security policy blocks inline scripts.

  (() => {
    const checks = document.querySelectorAll(".readiness-input");
    const ring = document.getElementById("readiness-ring");
    const count = document.getElementById("readiness-count");
    const message = document.getElementById("readiness-message");
    const description = document.getElementById("readiness-description");
    const reset = document.getElementById("readiness-reset");

    if (!checks.length || !ring || !count || !reset) return;

    function updateReadiness() {
      const completed = [...checks].filter(check => check.checked).length;
      const total = checks.length;
      const percentage = completed / total;
      const degrees = percentage * 360;

      count.textContent = `${completed}/${total}`;

      ring.style.background = `
        conic-gradient(
          var(--primary) 0deg,
          var(--cyan) ${degrees}deg,
          var(--line) ${degrees}deg
        )
      `;

      if (completed === 0) {
        message.textContent = "Ready when you are";
        description.textContent = "Complete the checklist to get started.";
      } else if (completed === total) {
        message.textContent = "Checklist completed!";
        description.textContent = "You are ready to begin troubleshooting.";
      } else {
        message.textContent = `${Math.round(percentage * 100)}% completed`;
        description.textContent = "Keep going. You are making progress.";
      }
    }

    checks.forEach(check => {
      check.addEventListener("change", updateReadiness);
    });

    reset.addEventListener("click", () => {
      checks.forEach(check => {
        check.checked = false;
      });

      updateReadiness();
    });

    updateReadiness();
  })();
