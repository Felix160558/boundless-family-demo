export const REPORT_TITLE = 'Learning report';

// All names, observations and next steps below are fictional demonstration data.
export const REPORT_PAGES = Object.freeze([
  {
    eyebrow: 'DEMO LEARNING REPORT · 01',
    title: 'This week in learning',
    subtitle: 'Sample student: Alex · Chemistry',
    sections: [
      {title: 'Current focus', body: 'Electrode reactions and electron transfer: understand, then explain.'},
      {title: 'Progress so far', body: 'Identifies oxidation and reduction in basic examples and explains why.'},
      {title: 'Next area to develop', body: 'Build a consistent check for independently written half-equations.'},
    ],
    footer: 'Fictional example. No real student records or assessment.',
  },
  {
    eyebrow: 'DEMO LEARNING REPORT · 02',
    title: 'Understanding the difficulty',
    subtitle: 'Three perspectives: student, parent and teacher.',
    sections: [
      {title: 'Student perspective', body: 'I understand in class, but sometimes do not know what to check first.'},
      {title: 'Teacher observation', body: 'Use a fixed order: check atoms first, then check charge.'},
      {title: 'Support at home', body: 'Allow time for the student to explain each check in their own words.'},
    ],
    footer: 'Fictional meeting material for this shared report demo.',
  },
  {
    eyebrow: 'DEMO LEARNING REPORT · 03',
    title: 'Goals for next week',
    subtitle: 'Small goals, clear actions.',
    sections: [
      {title: 'Student', body: 'Complete three basic exercises and show the checks beside each answer.'},
      {title: 'Teacher', body: 'Give brief feedback, then check understanding with a new question.'},
      {title: 'Parent', body: 'Set aside ten minutes to listen, review progress and discuss support.'},
    ],
    footer: 'Demo plan only. No real teacher has been notified.',
  },
  {
    eyebrow: 'DEMO LEARNING REPORT · 04',
    title: 'Agreeing on the next step',
    subtitle: 'Leave with a clear, shared plan.',
    sections: [
      {title: 'First action', body: 'Make a short checklist for conserving atoms and charge.'},
      {title: 'Next review', body: 'Bring one difficult question and one example of progress.'},
      {title: 'Shared agreement', body: 'The teacher guides, the student shares needs, and the parent supports.'},
    ],
    footer: 'End of demo report · Pages are controlled by the teacher.',
  },
].map(page => Object.freeze({...page, sections:Object.freeze(page.sections.map(section=>Object.freeze(section)))})));

const FONT = 'Arial, sans-serif';

function wrapText(context, text, width) {
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    let line = '';
    for (const word of paragraph.trim().split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && context.measureText(next).width > width) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
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
  if (!context) throw new Error('This browser cannot draw the shared report.');
  paintReport(context, pageIndex, width, height);
  return canvas;
}
