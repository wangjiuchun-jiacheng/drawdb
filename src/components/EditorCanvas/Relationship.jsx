import { useMemo, useRef } from "react";
import {
  Cardinality,
  darkBgTheme,
  ObjectType,
  Tab,
} from "../../data/constants";
import { calcPath } from "../../utils/calcPath";
import { createCrowsFootElement } from "../../utils/drawCrowsFoot";
import { useDiagram, useSettings, useLayout, useSelect } from "../../hooks";
import { useTranslation } from "react-i18next";
import { SideSheet } from "@douyinfe/semi-ui";
import RelationshipInfo from "../EditorSidePanel/RelationshipsTab/RelationshipInfo";

const labelFontSize = 16;

export default function Relationship({ data }) {
  const { settings } = useSettings();
  const { tables } = useDiagram();
  const { layout } = useLayout();
  const { selectedElement, setSelectedElement } = useSelect();
  const { t } = useTranslation();

  const pathValues = useMemo(() => {
    const startTable = tables.find((t) => t.id === data.startTableId);
    const endTable = tables.find((t) => t.id === data.endTableId);

    if (!startTable || !endTable) return null;

    return {
      startFieldIndex: startTable.fields.findIndex(
        (f) => f.id === data.startFieldId,
      ),
      endFieldIndex: endTable.fields.findIndex((f) => f.id === data.endFieldId),
      startTable: { x: startTable.x, y: startTable.y },
      endTable: { x: endTable.x, y: endTable.y },
    };
  }, [tables, data]);

  const pathRef = useRef();
  const labelRef = useRef();

  let cardinalityStart = "1";
  let cardinalityEnd = "1";

  switch (data.cardinality) {
    // the translated values are to ensure backwards compatibility
    case t(Cardinality.MANY_TO_ONE):
    case Cardinality.MANY_TO_ONE:
      cardinalityStart = "n";
      cardinalityEnd = "1";
      break;
    case t(Cardinality.ONE_TO_MANY):
    case Cardinality.ONE_TO_MANY:
      cardinalityStart = "1";
      cardinalityEnd = "n";
      break;
    case t(Cardinality.ONE_TO_ONE):
    case Cardinality.ONE_TO_ONE:
      cardinalityStart = "1";
      cardinalityEnd = "1";
      break;
    default:
      break;
  }

  let cardinalityStartX = 0;
  let cardinalityEndX = 0;
  let cardinalityStartY = 0;
  let cardinalityEndY = 0;
  let labelX = 0;
  let labelY = 0;

  let labelWidth = labelRef.current?.getBBox().width ?? 0;
  let labelHeight = labelRef.current?.getBBox().height ?? 0;

  const cardinalityOffset = 28;

  // 计算鸟爪元素
  let crowsFootStart = null;
  let crowsFootEnd = null;

  if (pathRef.current) {
    const pathLength = pathRef.current.getTotalLength();

    const labelPoint = pathRef.current.getPointAtLength(pathLength / 2);
    labelX = labelPoint.x - (labelWidth ?? 0) / 2;
    labelY = labelPoint.y + (labelHeight ?? 0) / 2;

    const point1 = pathRef.current.getPointAtLength(cardinalityOffset);
    cardinalityStartX = point1.x;
    cardinalityStartY = point1.y;
    const point2 = pathRef.current.getPointAtLength(
      pathLength - cardinalityOffset,
    );
    cardinalityEndX = point2.x;
    cardinalityEndY = point2.y;

    // 为"n"端生成鸟爪
    
    if (cardinalityStart === "n") {
      crowsFootStart = createCrowsFootElement(
        pathRef.current,
        0, // 连接线起始端
        "gray",
        2,
        true // isStart = true，起始端需要向外偏移
      );
    }
    if (cardinalityEnd === "n") {
      crowsFootEnd = createCrowsFootElement(
        pathRef.current,
        pathLength, // 连接线末端
        "gray",
        2,
        false // isStart = false，末端在表格边线上
      );
    }
  }

  const edit = () => {
    if (!layout.sidebar) {
      setSelectedElement((prev) => ({
        ...prev,
        element: ObjectType.RELATIONSHIP,
        id: data.id,
        open: true,
      }));
    } else {
      setSelectedElement((prev) => ({
        ...prev,
        currentTab: Tab.RELATIONSHIPS,
        element: ObjectType.RELATIONSHIP,
        id: data.id,
        open: true,
      }));
      if (selectedElement.currentTab !== Tab.RELATIONSHIPS) return;
      document
        .getElementById(`scroll_ref_${data.id}`)
        .scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <>
      <g className="select-none group" onDoubleClick={edit}>
        <path
          ref={pathRef}
          d={calcPath(pathValues, settings.tableWidth)}
          stroke="gray"
          className="group-hover:stroke-sky-700"
          fill="none"
          strokeWidth={2}
          cursor="pointer"
        />
        {settings.showRelationshipLabels && (
          <>
            <rect
              x={labelX - 2}
              y={labelY - labelFontSize}
              fill={settings.mode === "dark" ? darkBgTheme : "white"}
              width={labelWidth + 4}
              height={labelHeight}
            />
            <text
              x={labelX}
              y={labelY}
              fill={settings.mode === "dark" ? "lightgrey" : "#333"}
              fontSize={labelFontSize}
              fontWeight={500}
              ref={labelRef}
              className="group-hover:fill-sky-700"
            >
              {data.name}
            </text>
          </>
        )}
        {pathRef.current && settings.showCardinality && (
          <>
            {/* 起始端基数显示 */}
            {cardinalityStart === "n" && crowsFootStart ? (
              <path
                d={crowsFootStart.d}
                stroke={crowsFootStart.stroke}
                strokeWidth={crowsFootStart.strokeWidth}
                fill={crowsFootStart.fill}
                strokeLinecap={crowsFootStart.strokeLinecap}
                className="group-hover:stroke-sky-700"
              />
            ) : (
              <>
                <circle
                  cx={cardinalityStartX}
                  cy={cardinalityStartY}
                  r="12"
                  fill="grey"
                  className="group-hover:fill-sky-700"
                />
                <text
                  x={cardinalityStartX}
                  y={cardinalityStartY}
                  fill="white"
                  strokeWidth="0.5"
                  textAnchor="middle"
                  alignmentBaseline="middle"
                >
                  {cardinalityStart}
                </text>
              </>
            )}
            
            {/* 终端基数显示 */}
            {cardinalityEnd === "n" && crowsFootEnd ? (
              <path
                d={crowsFootEnd.d}
                stroke={crowsFootEnd.stroke}
                strokeWidth={crowsFootEnd.strokeWidth}
                fill={crowsFootEnd.fill}
                strokeLinecap={crowsFootEnd.strokeLinecap}
                className="group-hover:stroke-sky-700"
              />
            ) : (
              <>
                <circle
                  cx={cardinalityEndX}
                  cy={cardinalityEndY}
                  r="12"
                  fill="grey"
                  className="group-hover:fill-sky-700"
                />
                <text
                  x={cardinalityEndX}
                  y={cardinalityEndY}
                  fill="white"
                  strokeWidth="0.5"
                  textAnchor="middle"
                  alignmentBaseline="middle"
                >
                  {cardinalityEnd}
                </text>
              </>
            )}
          </>
        )}
      </g>
      <SideSheet
        title={t("edit")}
        size="small"
        visible={
          selectedElement.element === ObjectType.RELATIONSHIP &&
          selectedElement.id === data.id &&
          selectedElement.open &&
          !layout.sidebar
        }
        onCancel={() => {
          setSelectedElement((prev) => ({
            ...prev,
            open: false,
          }));
        }}
        style={{ paddingBottom: "16px" }}
      >
        <div className="sidesheet-theme">
          <RelationshipInfo data={data} />
        </div>
      </SideSheet>
    </>
  );
}
