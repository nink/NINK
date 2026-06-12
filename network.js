(function () {
  const nodesData = [
    {
      id: 'hi',
      label: 'Human Intellect',
      icon: '👥',
      x: 200,
      y: 50,
      desc: 'Domain experts providing ground-truth data verification, pipeline edge-case resolution, and system alignment.'
    },
    {
      id: 'env',
      label: 'Environment',
      icon: '🌱',
      x: 330,
      y: 100,
      desc: 'Real-world localized data, market conditions, supply chain dynamics, and ambient telemetry.'
    },
    {
      id: 'intent',
      label: 'User Intent',
      icon: '❤️',
      x: 370,
      y: 200,
      desc: 'Human demand, consumer behavior loops, and practical validation of data utility.'
    },
    {
      id: 'infra',
      label: 'Infrastructure',
      icon: '📟',
      x: 330,
      y: 300,
      desc: 'Local compute setups, high-performance node clustering, and system edge processors.'
    },
    {
      id: 'sensor',
      label: 'Sensory Input',
      icon: '🔍',
      x: 200,
      y: 350,
      desc: 'IoT sensors, camera arrays, and structural data points captured directly from real-world spaces.'
    },
    {
      id: 'robotics',
      label: 'Robotics & Actuation',
      icon: '🤖',
      x: 70,
      y: 300,
      desc: 'Physical or digital agents that execute automated workloads based on verified network knowledge.'
    },
    {
      id: 'curation',
      label: 'Data Curation',
      icon: '📖',
      x: 30,
      y: 200,
      desc: 'Algorithmic sanitization pipelines that structure, normalize, and parse messy input telemetry.'
    },
    {
      id: 'ai',
      label: 'Silicon Intelligence',
      icon: '🧠',
      x: 70,
      y: 100,
      desc: 'Frontier machine models running raw statistical token-prediction, high-speed vision transformations, and OCR.'
    }
  ];

  const nodesContainer = document.getElementById('network-nodes');
  const panel = document.getElementById('context-panel');
  if (!nodesContainer || !panel) return;

  const defaultPanelHtml = panel.innerHTML;

  function setCircleState(nodeId, active) {
    const circle = document.getElementById(`circle-${nodeId}`);
    if (!circle) return;
    circle.classList.toggle('network-node-circle--active', active);
  }

  function updatePanel(node) {
    nodesData.forEach((n) => setCircleState(n.id, n.id === node.id));
    panel.innerHTML = `
      <div class="context-panel-content context-panel-content--active">
        <div class="context-panel-head">
          <span class="context-panel-icon" aria-hidden="true">${node.icon}</span>
          <h3>${node.label}</h3>
        </div>
        <p>${node.desc}</p>
        <p class="context-panel-status">Node status: Active substrate input</p>
      </div>
    `;
  }

  function clearPanel() {
    nodesData.forEach((n) => setCircleState(n.id, false));
    panel.innerHTML = defaultPanelHtml;
  }

  nodesData.forEach((node) => {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('transform', `translate(${node.x}, ${node.y})`);
    group.setAttribute('class', 'network-node');
    group.setAttribute('tabindex', '0');
    group.setAttribute('role', 'button');
    group.setAttribute('aria-label', node.label);

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('r', '22');
    circle.setAttribute('class', 'network-node-circle');
    circle.id = `circle-${node.id}`;

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('class', 'network-node-icon');
    text.textContent = node.icon;

    group.appendChild(circle);
    group.appendChild(text);
    nodesContainer.appendChild(group);

    group.addEventListener('mouseenter', () => updatePanel(node));
    group.addEventListener('mouseleave', clearPanel);
    group.addEventListener('focus', () => updatePanel(node));
    group.addEventListener('blur', clearPanel);
  });
})();
