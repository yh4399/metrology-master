-- ===================================================
-- metrology-master 计量器具台账管理系统
-- 数据库初始化脚本
-- ===================================================

CREATE DATABASE IF NOT EXISTS metrology_master
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE metrology_master;

-- ===================================================
-- 用户表
-- ===================================================
CREATE TABLE users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  username   VARCHAR(50)  NOT NULL UNIQUE COMMENT '用户名',
  password   VARCHAR(255) NOT NULL COMMENT 'bcrypt哈希密码',
  nickname   VARCHAR(50)  COMMENT '昵称',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB COMMENT='用户表';

-- 管理员账号: admin / admin123
-- bcrypt hash of "admin123"
INSERT INTO users (username, password, nickname) VALUES
  ('admin', '$2a$10$xVqYLGEMC1JmKqiYKeaSfOqNxSPq.xqGqkZ1xBFfqSlL1FwG3gXqy', '管理员');

-- ===================================================
-- 计量器具表
-- ===================================================
CREATE TABLE instruments (
  id                    INT AUTO_INCREMENT PRIMARY KEY,

  -- 基础信息
  category              VARCHAR(50)  NOT NULL COMMENT '器具类别',
  serial_number         VARCHAR(100) COMMENT '出厂编号',
  model                 VARCHAR(100) COMMENT '型号',
  manufacturer          VARCHAR(200) COMMENT '生产厂家',

  -- 量程
  range_min             DECIMAL(15,8) COMMENT '量程下限',
  range_max             DECIMAL(15,8) COMMENT '量程上限',
  range_unit            VARCHAR(20)  COMMENT '单位(MPa/kPa/bar/℃/mm等)',

  -- 精度
  accuracy_class        VARCHAR(20)  COMMENT '准确度等级',

  -- 位置
  installation_location VARCHAR(300) COMMENT '安装位置',
  department            VARCHAR(100) COMMENT '所属部门/车间',

  -- 检验信息
  certificate_number    VARCHAR(100) COMMENT '检定证书编号',
  inspection_date       DATE         COMMENT '检验日期',
  valid_until           DATE         COMMENT '有效日期',
  inspection_result     VARCHAR(50)  COMMENT '检验结果(合格/不合格/待检)',
  inspection_unit       VARCHAR(200) COMMENT '检定单位',

  -- 状态
  status                ENUM('active','scrapped','borrowed','maintenance')
                         DEFAULT 'active' COMMENT '状态',
  remark                TEXT         COMMENT '备注',

  -- 扩展字段
  extra_fields          JSON         COMMENT '类别特有属性(如压变输出信号、液位计介质等)',

  -- 照片
  photo_url             VARCHAR(500) COMMENT '照片URL',

  -- 审计
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_category      (category),
  INDEX idx_serial        (serial_number),
  INDEX idx_manufacturer  (manufacturer),
  INDEX idx_location      (installation_location),
  INDEX idx_status        (status),
  INDEX idx_valid_until   (valid_until)
) ENGINE=InnoDB COMMENT='计量器具表';

-- ===================================================
-- 导入日志表
-- ===================================================
CREATE TABLE import_logs (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  file_name    VARCHAR(300) COMMENT '导入文件名',
  total_rows   INT COMMENT '总行数',
  success_rows INT COMMENT '成功行数',
  fail_rows    INT COMMENT '失败行数',
  error_detail JSON COMMENT '失败行的错误详情 [{row:1, errors:["..."]}]',
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB COMMENT='导入日志表';
