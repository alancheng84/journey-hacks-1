const exportButton = document.getElementById('exportJsonBtn');
const exportOutput = document.getElementById('exportOutput');
const runButton = document.getElementById('runMacroBtn');
const stopButton = document.getElementById('stopMacroBtn');
const serverStatus = document.getElementById('serverStatus');
const captureMouseButton = document.getElementById('captureMouseBtn');

const API_BASE_URL = window.location.origin.startsWith('http')
  ? window.location.origin
  : 'http://localhost:8080';
const RUN_ENDPOINT = `${API_BASE_URL}/macros/run`;
const STOP_ENDPOINT = `${API_BASE_URL}/macros/stop`;

const PRESS_KEY_OPTIONS = [
  ['Enter', 'ENTER'],
  ['Esc', 'ESCAPE'],
  ['Ctrl + L', 'CTRL_L']
];
const CLICK_BUTTON_OPTIONS = [
  ['Left', 'LEFT'],
  ['Right', 'RIGHT']
];

const KEY_COMBO_OPTIONS = [
  ['C', 'C'],
  ['V', 'V'],
  ['A', 'A']
];

const KEY_COMBO_VALUES = new Set(KEY_COMBO_OPTIONS.map(([, value]) => value));
const MODE_OPTIONS = [
  ['FAST', 'FAST'],
  ['NORMAL', 'NORMAL'],
  ['SLOW', 'SLOW']
];

const CUSTOM_BLOCKS = [
  // Add a new custom block by appending an object with: type, category, block (init), and toCommand().
  // Example:
  // {
  //   type: 'macro_wait_ms',
  //   category: 'Commands',
  //   block: {
  //     init() {
  //       this.appendDummyInput()
  //         .appendField('wait ms')
  //         .appendField(new Blockly.FieldNumber(1000, 0), 'MS');
  //       this.setPreviousStatement(true);
  //       this.setNextStatement(true);
  //       this.setColour(200);
  //     }
  //   },
  //   toCommand(block) {
  //     return { type: 'WAIT_MS', ms: Number(block.getFieldValue('MS')) || 0 };
  //   }
  // }
  {
    type: 'macro_ctrl_key',
    category: 'Actions',
    block: {
      init() {
        this.appendDummyInput()
          .appendField('ctrl +')
          .appendField(
            new Blockly.FieldDropdown(KEY_COMBO_OPTIONS, (value) =>
              KEY_COMBO_VALUES.has(value) ? value : KEY_COMBO_OPTIONS[0][1]
            ),
            'KEY'
          );
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(210);
      }
    },
    toCommand(block) {
      return { kind: 'ACTION', type: 'CTRL_KEY', key: block.getFieldValue('KEY') || '' };
    }
  },
  {
    type: 'macro_mouse_wiggle',
    category: 'Actions',
    block: {
      init() {
        this.appendDummyInput()
          .appendField('wiggle mouse left/right')
          .appendField(new Blockly.FieldNumber(20, 1), 'PX')
          .appendField('px');
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(210);
      }
    },
    toCommand(block) {
      const px = Number(block.getFieldValue('PX')) || 0;
      return [
        { kind: 'ACTION', type: 'MOUSE_MOVE', dx: -px, dy: 0 },
        { kind: 'ACTION', type: 'MOUSE_MOVE', dx: px, dy: 0 }
      ];
    }
  },
  {
    type: 'macro_mouse_move_to',
    category: 'Actions',
    block: {
      init() {
        this.appendDummyInput()
          .appendField('move mouse to x')
          .appendField(new Blockly.FieldNumber(0, 0), 'X')
          .appendField('y')
          .appendField(new Blockly.FieldNumber(0, 0), 'Y');
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(210);
      }
    },
    toCommand(block) {
      const x = Number(block.getFieldValue('X')) || 0;
      const y = Number(block.getFieldValue('Y')) || 0;
      return { kind: 'ACTION', type: 'MOUSE_MOVE_TO', x, y };
    }
  },
  {
    type: 'macro_mouse_click',
    category: 'Actions',
    block: {
      init() {
        this.appendDummyInput()
          .appendField('click')
          .appendField(new Blockly.FieldDropdown(CLICK_BUTTON_OPTIONS), 'BUTTON')
          .appendField('x')
          .appendField(new Blockly.FieldNumber(1, 1), 'COUNT');
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(210);
      }
    },
    toCommand(block) {
      const count = Number(block.getFieldValue('COUNT')) || 1;
      return {
        kind: 'ACTION',
        type: 'MOUSE_CLICK',
        button: block.getFieldValue('BUTTON') || 'LEFT',
        count
      };
    }
  },
  {
    type: 'macro_type_text',
    category: 'Actions',
    block: {
      init() {
        this.appendDummyInput()
          .appendField('type text')
          .appendField(new Blockly.FieldTextInput('hello'), 'TEXT');
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(210);
      }
    },
    toCommand(block) {
      return { kind: 'ACTION', type: 'TYPE_TEXT', text: block.getFieldValue('TEXT') || '' };
    }
  },
  {
    type: 'macro_wait_ms',
    category: 'Actions',
    block: {
      init() {
        this.appendDummyInput()
          .appendField('wait')
          .appendField(new Blockly.FieldNumber(250, 0), 'MS')
          .appendField('ms');
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(210);
      }
    },
    toCommand(block) {
      const ms = Number(block.getFieldValue('MS')) || 0;
      return { kind: 'ACTION', type: 'WAIT_MS', ms };
    }
  },
  {
    type: 'macro_press_key',
    category: 'Actions',
    block: {
      init() {
        this.appendDummyInput()
          .appendField('press key')
          .appendField(new Blockly.FieldDropdown(PRESS_KEY_OPTIONS), 'KEY');
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(210);
      }
    },
    toCommand(block) {
      return { kind: 'ACTION', type: 'PRESS_KEY', key: block.getFieldValue('KEY') || '' };
    }
  },
  {
    type: 'macro_open_url',
    category: 'Actions',
    block: {
      init() {
        this.appendDummyInput()
          .appendField('open url')
          .appendField(new Blockly.FieldTextInput('https://'), 'URL');
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(210);
      }
    },
    toCommand(block) {
      return { kind: 'ACTION', type: 'OPEN_URL', url: block.getFieldValue('URL') || '' };
    }
  },
  {
    type: 'macro_repeat',
    category: 'Actions',
    block: {
      init() {
        this.appendDummyInput()
          .appendField('repeat')
          .appendField(new Blockly.FieldNumber(2, 1), 'COUNT')
          .appendField('times');
        this.appendStatementInput('DO').appendField('do');
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(210);
      }
    },
    toCommand(block, exporters) {
      const count = Number(block.getFieldValue('COUNT')) || 1;
      const child = block.getInputTargetBlock('DO');
      const steps = child ? exportBlockChain(child, exporters) : [];
      return { kind: 'CONTROL', type: 'REPEAT', count, steps };
    }
  },
  {
    type: 'macro_set_mode',
    category: 'Settings',
    block: {
      init() {
        this.appendDummyInput()
          .appendField('set mode')
          .appendField(new Blockly.FieldDropdown(MODE_OPTIONS), 'MODE');
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(120);
      }
    },
    toCommand(block) {
      return { kind: 'SETTING', type: 'SET_MODE', mode: block.getFieldValue('MODE') || '' };
    }
  },
  {
    type: 'macro_settings_start',
    category: 'Settings',
    block: {
      init() {
        this.appendDummyInput().appendField('start');
        if (typeof this.setHat === 'function') {
          this.setHat(true);
        }
        this.setNextStatement(true);
        this.setColour(120);
      }
    },
    toCommand() {
      return { kind: 'SETTING', type: 'START' };
    }
  }
];

const TOOLBOX_CONFIG = [
  // { name: 'Macros', blocks: ['controls_repeat_ext'] },
  {
    name: 'Actions',
    blocks: [
      'text',
      'math_number',
      'macro_ctrl_key',
      'macro_mouse_wiggle',
      'macro_mouse_move_to',
      'macro_mouse_click',
      'macro_type_text',
      'macro_wait_ms',
      'macro_press_key',
      'macro_open_url',
      'macro_repeat'
    ]
  },
  { name: 'Settings', blocks: ['macro_settings_start', 'macro_set_mode'] }
];

function registerCustomBlocks() {
  for (const customBlock of CUSTOM_BLOCKS) {
    Blockly.Blocks[customBlock.type] = customBlock.block;
  }
}

function buildToolboxXml(categories) {
  let xml = '<xml>';
  for (const category of categories) {
    xml += `<category name="${category.name}">`;
    for (const blockType of category.blocks) {
      xml += `<block type="${blockType}"></block>`;
    }
    xml += '</category>';
  }
  xml += '</xml>';
  return Blockly.utils.xml.textToDom(xml);
}

function getPrintCommand(printBlock) {
  const inputBlock = printBlock.getInputTargetBlock('TEXT');
  if (!inputBlock) {
    return { type: 'PRINT_TEXT', text: '' };
  }

  if (inputBlock.type === 'text') {
    return { type: 'PRINT_TEXT', text: inputBlock.getFieldValue('TEXT') || '' };
  }

  if (inputBlock.type === 'math_number') {
    const rawNumber = inputBlock.getFieldValue('NUM');
    const numberValue = rawNumber === null ? 0 : Number(rawNumber);
    return { type: 'PRINT_NUMBER', number: Number.isNaN(numberValue) ? 0 : numberValue };
  }

  return { type: 'PRINT_TEXT', text: `[UNSUPPORTED:${inputBlock.type}]` };
}

function createExporters() {
  const exporters = {
    text_print: getPrintCommand
  };

  for (const customBlock of CUSTOM_BLOCKS) {
    exporters[customBlock.type] = customBlock.toCommand;
  }

  return exporters;
}

function exportBlockChain(startBlock, exporters) {
  const steps = [];
  let currentBlock = startBlock;
  while (currentBlock) {
    const exporter = exporters[currentBlock.type];
    if (exporter) {
      const command = exporter(currentBlock, exporters);
      if (Array.isArray(command)) {
        steps.push(...command);
      } else if (command) {
        steps.push(command);
      }
    }
    currentBlock = currentBlock.getNextBlock();
  }
  return steps;
}

function exportWorkspaceAsCommands(workspace, exporters) {
  const steps = [];
  const topBlocks = workspace.getTopBlocks(true);
  for (const topBlock of topBlocks) {
    steps.push(...exportBlockChain(topBlock, exporters));
  }
  return { steps };
}

registerCustomBlocks();
const toolbox = buildToolboxXml(TOOLBOX_CONFIG);
const workspace = Blockly.inject('blocklyDiv', { toolbox });
const exporters = createExporters();
let lastMousePosition = { x: 0, y: 0 };

function setServerStatus(message, isError = false) {
  if (!serverStatus) {
    return;
  }
  serverStatus.textContent = message;
  serverStatus.style.color = isError ? '#e11d48' : '';
}

exportButton.addEventListener('click', () => {
  const exportJson = exportWorkspaceAsCommands(workspace, exporters);
  exportOutput.textContent = JSON.stringify(exportJson, null, 2);
});

function applyCapturedMousePosition() {
  const x = Math.round(lastMousePosition.x);
  const y = Math.round(lastMousePosition.y);
  const selected = Blockly.selected;

  if (selected && selected.type === 'macro_mouse_move_to') {
    selected.setFieldValue(String(x), 'X');
    selected.setFieldValue(String(y), 'Y');
  } else {
    const block = workspace.newBlock('macro_mouse_move_to');
    block.setFieldValue(String(x), 'X');
    block.setFieldValue(String(y), 'Y');
    block.initSvg();
    block.render();
    block.moveBy(40, 40);
  }

  setServerStatus(`Captured position: ${x}, ${y}`);
}

window.addEventListener('mousemove', (event) => {
  lastMousePosition = { x: event.screenX, y: event.screenY };
});

captureMouseButton?.addEventListener('click', applyCapturedMousePosition);

async function runMacro() {
  const payload = exportWorkspaceAsCommands(workspace, exporters);
  exportOutput.textContent = JSON.stringify(payload, null, 2);
  setServerStatus('Running macro...');
  try {
    const response = await fetch(RUN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`Run failed: ${response.status}`);
    }
    const data = await response.json().catch(() => null);
    const message = data?.message || 'Run started.';
    setServerStatus(message);
  } catch (error) {
    setServerStatus(error?.message || 'Run failed.', true);
  }
}

async function stopMacro() {
  setServerStatus('Stopping macro...');
  try {
    const response = await fetch(STOP_ENDPOINT, { method: 'POST' });
    if (!response.ok) {
      throw new Error(`Stop failed: ${response.status}`);
    }
    const data = await response.json().catch(() => null);
    const message = data?.message || 'Stopped.';
    setServerStatus(message);
  } catch (error) {
    setServerStatus(error?.message || 'Stop failed.', true);
  }
}

runButton?.addEventListener('click', runMacro);
stopButton?.addEventListener('click', stopMacro);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' || event.key === 'F6') {
    stopMacro();
  }
});
