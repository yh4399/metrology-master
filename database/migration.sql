-- ===================================================
-- metrology-master 数据库迁移脚本
-- 用于已存在数据库的升级
-- ===================================================

USE metrology_master;

-- 1. 量程小数位数从 DECIMAL(10,3) 改为 DECIMAL(15,8)
--    允许更灵活的小数位数，不做统一限制
ALTER TABLE instruments
  MODIFY range_min DECIMAL(15,8) COMMENT '量程下限',
  MODIFY range_max DECIMAL(15,8) COMMENT '量程上限';

-- 2. 照片URL字段长度扩展（支持更长的文件路径）
ALTER TABLE instruments
  MODIFY photo_url VARCHAR(500) COMMENT '照片URL';
