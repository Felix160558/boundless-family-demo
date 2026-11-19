export const REPORT_TITLE = '一起看见成长';

// All names, observations and next steps below are fictional demonstration data.
export const REPORT_PAGES = Object.freeze([
  {
    eyebrow: '示例学习报告 · 01',
    title: '本周学习概览',
    subtitle: '示例学生：林同学 · 高中化学',
    sections: [
      {title: '这周在学什么', body: '电极反应与电子转移。先理解概念，再把过程说清楚。'},
      {title: '已经有的进步', body: '能在基础例题中识别氧化与还原，并说明判断理由。'},
      {title: '一起关注的地方', body: '独立书写半反应式时，还需要形成稳定的检查步骤。'},
    ],
    footer: '全部内容均为演示示例，不对应真实学生或实际评价。',
  },
  {
    eyebrow: '示例学习报告 · 02',
    title: '把卡点说清楚',
    subtitle: '学生、家长和老师，各自补充一个视角。',
    sections: [
      {title: '学生的表达', body: '听讲时能够理解，独立练习时有时不知道先检查哪里。'},
      {title: '老师的观察', body: '尝试固定顺序：先检查原子守恒，再检查电荷守恒。'},
      {title: '家长的支持', body: '留出解释的时间，听孩子用自己的语言说清检查过程。'},
    ],
    footer: '这是一段虚构的会谈材料，用于体验三方共同查看。',
  },
  {
    eyebrow: '示例学习报告 · 03',
    title: '下一周的小目标',
    subtitle: '把目标变小，把行动说具体。',
    sections: [
      {title: '学生', body: '完成三道基础练习，并在答案旁保留自己的检查过程。'},
      {title: '老师', body: '提供一次简短反馈，再用一道新情境题检查理解。'},
      {title: '家长', body: '安排一次十分钟复盘，先听孩子解释，再讨论需要的帮助。'},
    ],
    footer: '行动安排仅供原型演示，尚未发送给任何真实老师。',
  },
  {
    eyebrow: '示例学习报告 · 04',
    title: '带着一个共识离开',
    subtitle: '让今天的讨论，成为下一次进步的起点。',
    sections: [
      {title: '先完成', body: '整理一张“原子守恒与电荷守恒”的检查清单。'},
      {title: '下次一起看', body: '一道仍有困惑的题目，以及一个已经做到的小进步。'},
      {title: '共同确认', body: '老师给出方向，学生说明需要，家长提供可持续的支持。'},
    ],
    footer: '演示报告结束 · 由老师控制共享面板的翻页。',
  },
].map(page => Object.freeze({...page, sections:Object.freeze(page.sections.map(section=>Object.freeze(section)))})));

const FONT = 'Arial, "PingFang SC", "Microsoft YaHei", sans-serif';

function wrapText(context, text, width) {
  const lines = [];
  let line = '';
  for (const character of String(text)) {
    if (character === '\n') { lines.push(line); line = ''; continue; }
    if (line && context.measureText(line + character).width > width) {
      lines.push(line);
      line = character;
    } else line += character;
  }
  if (line) lines.push(line);
  return lines;
}

export function paintReport(context, pageIndex = 0, width = 1600, height = 900) {
  const index = Math.max(0, Math.min(REPORT_PAGES.length - 1, Math.trunc(Number(pageIndex) || 0)));
  const page = REPORT_PAGES[index];
  context.save();
  context.setTransform(width / 1600, 0, 0, height / 900, 0, 0);
  context.fillStyle = '#eaf0f2';
  context.fillRect(0, 0, 1600, 900);
  context.fillStyle = '#7267c7';
  context.fillRect(0, 0, 13, 900);
  context.textBaseline = 'alphabetic';
  context.textAlign = 'left';
  context.fillStyle = '#626884';
  context.font = `500 30px ${FONT}`;
  context.fillText(page.eyebrow, 91, 76);
  context.fillStyle = '#172538';
  context.font = `600 66px ${FONT}`;
  context.fillText(page.title, 87, 163);
  context.fillStyle = '#566578';
  context.font = `400 35px ${FONT}`;
  context.fillText(page.subtitle, 91, 221);
  context.fillStyle = '#d4dce1';
  context.fillRect(91, 259, 1418, 2);

  page.sections.forEach((section, sectionIndex) => {
    const y = 324 + sectionIndex * 152;
    context.fillStyle = '#655cb3';
    context.font = `600 37px ${FONT}`;
    context.fillText(section.title, 91, y);
    context.fillStyle = '#233449';
    context.font = `400 42px ${FONT}`;
    const lines = wrapText(context, section.body, 1400);
    lines.slice(0, 2).forEach((line, lineIndex) => context.fillText(line, 91, y + 59 + lineIndex * 52));
  });

  context.fillStyle = '#d4dce1';
  context.fillRect(91, 802, 1418, 2);
  context.fillStyle = '#647285';
  context.font = `400 28px ${FONT}`;
  context.fillText(page.footer, 91, 855);
  context.textAlign = 'right';
  context.font = `500 30px ${FONT}`;
  context.fillText(`${index + 1} / ${REPORT_PAGES.length}`, 1507, 855);
  context.restore();
  return page;
}

export function createReportCanvas(pageIndex = 0, {width = 1600, height = 900} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前浏览器无法绘制共享报告。');
  paintReport(context, pageIndex, width, height);
  return canvas;
}
