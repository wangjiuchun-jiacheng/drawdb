/**
 * 计算连接线端点的切线角度
 * @param {SVGPathElement} pathElement - SVG路径元素
 * @param {number} position - 路径上的位置（0-1之间，或具体长度）
 * @param {boolean} isLength - position是否为具体长度值
 * @returns {number} 角度（弧度）
 */
export function calculatePathAngle(pathElement, position, isLength = false) {
  if (!pathElement) return 0;

  const pathLength = pathElement.getTotalLength();
  const targetLength = isLength ? position : position * pathLength;

  // 获取目标点和稍前一点的坐标来计算切线方向
  const offset = Math.min(30, pathLength * 0.1); // 使用更大的偏移量，最大30px或路径长度的10%
  let point1, point2;

  if (targetLength <= offset) {
    // 在起始端，使用起始点和稍后一点
    point1 = pathElement.getPointAtLength(0);
    point2 = pathElement.getPointAtLength(offset);
  } else if (targetLength >= pathLength - offset) {
    // 在末端，使用更远的前一点和末端点来获取更准确的方向
    point1 = pathElement.getPointAtLength(pathLength - offset);
    point2 = pathElement.getPointAtLength(pathLength);
  } else {
    // 在中间，使用前后两点
    point1 = pathElement.getPointAtLength(targetLength - offset);
    point2 = pathElement.getPointAtLength(targetLength + offset);
  }

  // 计算两点之间的角度
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;

  return Math.atan2(dy, dx);
}

/**
 * 生成鸟爪形状的SVG路径
 * @param {number} x - 鸟爪顶点的x坐标
 * @param {number} y - 鸟爪顶点的y坐标
 * @param {number} angle - 连接线的角度（弧度）
 * @param {number} length - 鸟爪的长度
 * @param {number} forkAngle - 分叉角度（弧度）
 * @returns {string} SVG路径字符串
 */
export function generateCrowsFootPath(
  x,
  y,
  angle,
  forkLength = 15,
  forkAngle = Math.PI / 6,
) {
  // x, y 是表格边线上的连接点（点3）
  // angle 是连接线方向角度

  // 计算汇聚点到表格边线的距离（点1到点3的距离）
  const convergenceDistance = forkLength * Math.cos(forkAngle);

  // 计算汇聚点（点1）的坐标
  const convergenceX = x - Math.cos(angle) * convergenceDistance;
  const convergenceY = y - Math.sin(angle) * convergenceDistance;

  // 计算三个分叉端点的坐标（都在表格边线上）
  const centerAngle = angle; // 中心分叉（点3）就是传入的连接点
  const leftAngle = centerAngle - forkAngle; // 左分叉（点2）
  const rightAngle = centerAngle + forkAngle; // 右分叉（点4）

  // 点3（中心）就是传入的 x, y
  const centerX = x;
  const centerY = y;

  // 点2（左分叉）
  const leftX = convergenceX + Math.cos(leftAngle) * forkLength;
  const leftY = convergenceY + Math.sin(leftAngle) * forkLength;

  // 点4（右分叉）
  const rightX = convergenceX + Math.cos(rightAngle) * forkLength;
  const rightY = convergenceY + Math.sin(rightAngle) * forkLength;

  // 生成SVG路径：从汇聚点（1）到三个分叉端点（2、3、4）
  return `M ${convergenceX} ${convergenceY} L ${leftX} ${leftY} M ${convergenceX} ${convergenceY} L ${centerX} ${centerY} M ${convergenceX} ${convergenceY} L ${rightX} ${rightY}`;
}

/**
 * 为关系端点创建鸟爪SVG元素数据
 * @param {SVGPathElement} pathElement - 连接线路径元素
 * @param {number} position - 端点在路径上的位置（具体长度值）
 * @param {string} strokeColor - 线条颜色
 * @param {number} strokeWidth - 线条宽度
 * @param {boolean} isStart - 是否为起始端（true表示起始端，false表示末端）
 * @returns {Object} 包含鸟爪SVG属性的对象
 */
export function createCrowsFootElement(
  pathElement,
  position,
  strokeColor = "gray",
  strokeWidth = 2,
  isStart = false,
) {
  if (!pathElement) return null;

  // const pathLength = pathElement.getTotalLength();
  const angle = calculatePathAngle(pathElement, position, true);

  let point;
  let crowsAngle = angle;

  if (isStart) {
    // 起始端：鸟爪向外偏移，避免被表格遮挡
    const offset = 1; // 向外偏移距离
    point = pathElement.getPointAtLength(position + offset);
    // 起始端鸟爪方向需要反向（指向远离表格的方向）
    crowsAngle = angle + Math.PI;
  } else {
    // 末端：鸟爪在表格边线上
    point = pathElement.getPointAtLength(position);
  }

  const path = generateCrowsFootPath(point.x, point.y, crowsAngle);

  return {
    d: path,
    stroke: strokeColor,
    strokeWidth: strokeWidth,
    fill: "none",
    strokeLinecap: "round",
  };
}
