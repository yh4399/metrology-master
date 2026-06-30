// 测试数据填充脚本 - 统一模型版本
const { getDb } = require('./models/db');
const Instrument = require('./models/instrument');

async function seed() {
  await getDb();

  const testData = [
    { category: '压力表', serial_number: 'SY-2024-001', model: 'Y-100', manufacturer: '上海仪表厂', range_min: 0, range_max: 1.6, range_unit: 'MPa', accuracy_class: '1.6', installation_location: '锅炉房1号', department: '动力车间', certificate_number: 'JD-2024-001', inspection_date: '2024-05-15', valid_until: '2025-05-14', inspection_result: '合格', inspection_unit: '市计量院', status: 'active' },
    { category: '压力变送器', serial_number: 'YB-2024-002', model: 'EJA430A', manufacturer: '横河电机', range_min: 0, range_max: 2.5, range_unit: 'MPa', accuracy_class: '0.5', installation_location: '汽轮机厂房', department: '动力车间', certificate_number: 'JD-2024-002', inspection_date: '2024-06-01', valid_until: '2025-05-31', inspection_result: '合格', inspection_unit: '市计量院', status: 'active' },
    { category: '温度计', serial_number: 'WD-2024-003', model: 'WSS-411', manufacturer: '北京仪表厂', range_min: 0, range_max: 100, range_unit: '℃', accuracy_class: '1.0', installation_location: '空压站', department: '动力车间', certificate_number: 'JD-2024-003', inspection_date: '2024-03-20', valid_until: '2024-09-19', inspection_result: '不合格', inspection_unit: '省计量院', status: 'scrapped' },
    { category: '液位计', serial_number: 'YW-2024-004', model: 'UHZ-519', manufacturer: '上海自动化仪表', range_min: 0, range_max: 2000, range_unit: 'mm', accuracy_class: '1.5', installation_location: '水处理车间', department: '水处理', certificate_number: 'JD-2024-004', inspection_date: '2024-07-10', valid_until: '2025-07-09', inspection_result: '合格', inspection_unit: '市计量院', status: 'active' },
    { category: '流量计', serial_number: 'LL-2024-005', model: 'LWGY-50', manufacturer: '开封仪表厂', range_min: 0, range_max: 50, range_unit: 'm³/h', accuracy_class: '0.5', installation_location: '天然气站', department: '能源部', status: 'maintenance' },
    { category: '双金属温度计', serial_number: 'WD-2024-006', model: 'WSS-481', manufacturer: '天津仪表厂', range_min: 0, range_max: 300, range_unit: '℃', accuracy_class: '1.5', installation_location: '锅炉房2号', department: '动力车间', valid_until: '2024-12-31', status: 'active' },
    { category: '压力表', serial_number: 'SY-2024-007', model: 'Y-150', manufacturer: '西安仪表厂', range_min: 0, range_max: 0.6, range_unit: 'MPa', accuracy_class: '2.5', installation_location: '空分装置', department: '动力车间', valid_until: '2024-08-15', status: 'active' },
    { category: '热电偶', serial_number: 'RO-2024-008', model: 'WRN-230', manufacturer: '四川仪表厂', range_min: 0, range_max: 1200, range_unit: '℃', accuracy_class: '1.0', installation_location: '加热炉', department: '热处理', certificate_number: 'JD-2024-008', inspection_date: '2024-04-01', valid_until: '2025-03-31', inspection_result: '合格', inspection_unit: '省计量院', status: 'active' },
    // 新增几条近期到期的测试数据
    { category: '压力表', serial_number: 'SY-2025-010', model: 'Y-100', manufacturer: '西安仪表厂', range_min: 0, range_max: 2.5, range_unit: 'MPa', accuracy_class: '1.6', installation_location: '锅炉房3号', department: '动力车间', certificate_number: 'JD-2025-010', inspection_date: '2025-01-15', valid_until: '2026-01-14', inspection_result: '合格', inspection_unit: '市计量院', status: 'active' },
    { category: '温度变送器', serial_number: 'WB-2025-011', model: 'EJA110A', manufacturer: '横河电机', range_min: -50, range_max: 200, range_unit: '℃', accuracy_class: '0.2', installation_location: '反应釜', department: '生产车间', certificate_number: 'JD-2025-011', inspection_date: '2025-03-01', valid_until: '2026-02-28', inspection_result: '合格', inspection_unit: '省计量院', status: 'active' },
    // 已过期
    { category: '真空表', serial_number: 'ZK-2024-009', model: 'YZ-100', manufacturer: '北京仪表厂', range_min: -0.1, range_max: 0, range_unit: 'MPa', accuracy_class: '1.6', installation_location: '真空泵房', department: '动力车间', valid_until: '2025-10-01', status: 'active' },
  ];

  for (const data of testData) {
    const result = await Instrument.create(data);
    console.log('Created id:', result.lastInsertId, data.serial_number, data.category);
  }

  console.log('Done! Inserted', testData.length, 'records.');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
