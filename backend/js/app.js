const exportButton = document.getElementById('exportJsonBtn');
const exportOutput = document.getElementById('exportOutput');

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
  }
];

const TOOLBOX_CONFIG = [
  // { name: 'Macros', blocks: ['controls_repeat_ext'] },
  { name: 'Actions', blocks: ['text', 'math_number', 'macro_ctrl_key'] },
  { name: 'Settings', blocks: ['macro_set_mode'] }
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

function exportWorkspaceAsCommands(workspace, exporters) {
  const steps = [];
  const topBlocks = workspace.getTopBlocks(true);

  for (const topBlock of topBlocks) {
    let currentBlock = topBlock;
    while (currentBlock) {
      const exporter = exporters[currentBlock.type];
      if (exporter) {
        steps.push(exporter(currentBlock));
      }
      currentBlock = currentBlock.getNextBlock();
    }
  }

  return { steps };
}

registerCustomBlocks();
const toolbox = buildToolboxXml(TOOLBOX_CONFIG);
const workspace = Blockly.inject('blocklyDiv', { toolbox });
const exporters = createExporters();

exportButton.addEventListener('click', () => {
  const exportJson = exportWorkspaceAsCommands(workspace, exporters);
  exportOutput.textContent = JSON.stringify(exportJson, null, 2);
});
