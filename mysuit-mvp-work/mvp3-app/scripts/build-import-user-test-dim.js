const fs = require('fs');
const path = require('path');

const output = path.resolve(__dirname, '../samples/import/user-test-my-report.dim.json');
const freeze = path.resolve(__dirname, '../samples/import/user-test-my-report.freeze.dim.json');
const border = () => ({
  top: { visible: true, color: '#000000', width: 1 },
  right: { visible: true, color: '#000000', width: 1 },
  bottom: { visible: true, color: '#000000', width: 1 },
  left: { visible: true, color: '#000000', width: 1 },
});
const style = (options = {}) => ({
  fontSize: options.fontSize || 10,
  bold: Boolean(options.bold),
  textAlign: options.textAlign || 'center',
  verticalAlign: 'middle',
  textColor: options.textColor || '#3A3A3A',
  backgroundColor: options.backgroundColor || '#FFFFFF',
  border: options.border || border(),
});
const cell = (text, options) => ({ text, style: style(options) });
const dataRow = (values) => ({
  height: 25,
  cells: values.map((value, index) => cell(value, {
    backgroundColor: index === 0 ? '#D0D0D0' : '#FFFFFF',
    textAlign: index === 4 ? 'left' : 'center',
  })),
});
const totalRow = (label, amount) => ({
  height: 25,
  cells: [
    cell('', { bold: true, backgroundColor: '#666666', textColor: '#FFFFFF' }),
    cell('', { bold: true, backgroundColor: '#666666', textColor: '#FFFFFF' }),
    cell(label, { bold: true, backgroundColor: '#666666', textColor: '#FFFFFF' }),
    cell('', { bold: true, backgroundColor: '#666666', textColor: '#FFFFFF' }),
    cell('', { bold: true, backgroundColor: '#666666', textColor: '#FFFFFF' }),
    cell(amount, { backgroundColor: '#FFFFFF' }),
  ],
});
const rows = [
  { height: 25, cells: ['번호', '이름', '직책', '핸드폰 번호', '주소', '연봉'].map((value) => cell(value, { bold: true, backgroundColor: '#666666', textColor: '#FFFFFF' })) },
  dataRow(['1', '이기영', '대표이사', '010-2215-2248', '서울특별시 강남구 개포', '13,000.0']),
  totalRow('대표이사 합계', '13,000.0'),
  dataRow(['1', '윤기준', '상무', '010-3318-1547', '경기도 구리시 수택동', '9,000.0']),
  dataRow(['2', '박미호', '상무', '010-8951-1456', '경기도 고양시 덕양구 장', '8,000.0']),
  totalRow('상무 합계', '17,000.0'),
  dataRow(['1', '홍만표', '이사', '010-2214-1156', '서울특별시 강동구 천호', '6,500.0']),
  dataRow(['2', '김민수', '이사', '010-5515-3348', '경기도 용인시 기흥동', '6,000.0']),
  totalRow('이사 합계', '12,500.0'),
  dataRow(['1', '홍길동', '부장', '010-2211-5623', '서울특별시 성동구 성수', '5,000.0']),
  dataRow(['2', '김철수', '부장', '010-4478-1123', '서울특별시 중랑구 면목', '4,500.0']),
  totalRow('부장 합계', '9,500.0'),
  dataRow(['1', '유동근', '차장', '010-3315-7846', '서울특별시 강서구 마곡', '4,000.0']),
  dataRow(['2', '김미러', '차장', '010-6148-7894', '서울특별시 송파구 방이', '3,800.0']),
  dataRow(['3', '최홍석', '차장', '010-5547-2333', '서울특별시 동대문구 전', '3,700.0']),
  totalRow('차장 합계', '11,500.0'),
  dataRow(['1', '이홍구', '과장', '010-3458-0015', '서울특별시 중구 신당동', '3,400.0']),
  totalRow('과장 합계', '3,400.0'),
  dataRow(['1', '이지우', '대리', '010-9871-2365', '서울특별시 중랑구 면목', '3,200.0']),
  dataRow(['2', '박기수', '대리', '010-2236-1125', '경기도 수원시 인계동', '3,100.0']),
  totalRow('대리 합계', '6,300.0'),
  dataRow(['1', '박철호', '사원', '010-4468-3596', '서울특별시 광진구 구의', '2,700.0']),
  dataRow(['2', '손오공', '사원', '010-5567-8894', '서울특별시 노원구 상계', '2,600.0']),
  dataRow(['3', '오기수', '사원', '010-7844-2236', '경기도 구리시 인창동', '2,500.0']),
  dataRow(['4', '김가영', '사원', '010-2233-4489', '서울특별시 용산구 이태', '2,400.0']),
  dataRow(['5', '윤석구', '사원', '010-6578-1238', '서울특별시 노원구 하계', '2,450.0']),
  dataRow(['6', '김호영', '사원', '010-6578-1238', '서울특별시 서대문구 연', '2,550.0']),
  dataRow(['7', '김민준', '사원', '010-2256-4789', '서울특별시 마포구 서교', '2,650.0']),
  dataRow(['8', '배현여름', '사원', '010-5456-5344', '경기도 수원시 영통구 광', '2,700.0']),
  dataRow(['9', '김별다미', '사원', '010-3289-4590', '경기도 수원시 영통구 광', '3,650.0']),
  dataRow(['10', '송빛다운', '사원', '010-1643-4563', '경기도 수원시 영통구 광', '3,900.0']),
  dataRow(['11', '최소솔', '사원', '010-0908-0990', '경기도 수원시 영통구 광', '2,050.0']),
  dataRow(['12', '이새롬', '사원', '010-1212-1212', '경기도 수원시 영통구 광', '2,500.0']),
  totalRow('사원 합계', '32,650.0'),
  totalRow('전체합계', '105,850.0'),
];
const textStyle = (fontSize, bold, textAlign, textColor = '#333333', backgroundColor = '#FFFFFF') => ({
  fontSize, bold, textAlign, verticalAlign: 'middle', textColor, backgroundColor,
});
const dim = {
  version: '1.2',
  page: { width: 794, height: 1123 },
  elements: [
    { id: 'trial_watermark', type: 'text', x: 10, y: 0, width: 180, height: 60, text: 'TRIAL', style: textStyle(54, false, 'left', '#D3D3D3') },
    { id: 'report_title', type: 'text', x: 300, y: 10, width: 194, height: 35, text: '사내주소록', style: textStyle(20, true, 'center', '#111111') },
    { id: 'print_label', type: 'text', x: 24, y: 68, width: 55, height: 22, text: '출력일', style: textStyle(10, false, 'left') },
    { id: 'print_value', type: 'text', x: 130, y: 68, width: 75, height: 22, text: '1', style: textStyle(10, false, 'center') },
    { id: 'printed_at_label', type: 'text', x: 560, y: 68, width: 65, height: 22, text: '출력일자', style: textStyle(10, false, 'left') },
    { id: 'printed_at_value', type: 'text', x: 635, y: 68, width: 145, height: 22, text: '2026-08-28 06:04:38', style: textStyle(10, false, 'right') },
    { id: 'address_book', type: 'table', x: 0, y: 106, width: 794, height: 875,
      columns: [132, 132, 132, 133, 132, 133].map((width, index) => ({ id: `column_${index + 1}`, width })), rows },
    { id: 'page_number', type: 'text', x: 360, y: 1085, width: 74, height: 20, text: '1 / 1', style: textStyle(10, false, 'center') },
  ],
};
const serialized = `${JSON.stringify(dim, null, 2)}\n`;
fs.writeFileSync(output, serialized);
fs.writeFileSync(freeze, serialized);
process.stdout.write(`${JSON.stringify({ output, freeze, elements: dim.elements.length, rows: rows.length })}\n`);
