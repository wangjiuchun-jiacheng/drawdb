import { createContext, useState, useEffect } from "react";
import { Action, DB, ObjectType, defaultBlue } from "../data/constants";
import { useTransform, useUndoRedo, useSelect } from "../hooks";
import { Toast } from "@douyinfe/semi-ui";
import { useTranslation } from "react-i18next";
import { nanoid } from "nanoid";
import { microBridge } from "../utils/microapp-bridge";

export const DiagramContext = createContext(null);

export default function DiagramContextProvider({ children }) {
  const { t } = useTranslation();
  const [database, setDatabase] = useState(DB.GENERIC);
  const [tables, setTables] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const { transform } = useTransform();
  const { setUndoStack, setRedoStack } = useUndoRedo();
  const { selectedElement, setSelectedElement } = useSelect();

  // 微前端通信相关逻辑
  useEffect(() => {
    if (window.__POWERED_BY_QIANKUN__) {
      // 监听来自主应用的导入数据事件
      microBridge.onParentEvent('drawdb-import', (importData) => {
        if (importData && importData.diagram) {
          const { diagram } = importData;
          console.log('[DrawDB] 收到导入数据:', diagram);
          
          if (diagram.tables) setTables(diagram.tables);
          if (diagram.relationships) setRelationships(diagram.relationships);
          if (diagram.database) setDatabase(diagram.database);
          
          Toast.success(t('data_imported') || '数据导入成功');
        }
      });

      // 监听导出数据请求
      microBridge.onParentEvent('drawdb-export-request', () => {
        const diagramData = {
          tables,
          relationships,
          database,
          timestamp: Date.now()
        };
        microBridge.exportData(diagramData);
      });

      // 发送准备就绪信号
      setTimeout(() => {
        microBridge.ready();
      }, 1000);

      // 清理函数
      return () => {
        microBridge.offParentEvent('drawdb-import');
        microBridge.offParentEvent('drawdb-export-request');
      };
    }
  }, [tables, relationships, database, t]);

  // 数据变化时通知主应用
  useEffect(() => {
    if (window.__POWERED_BY_QIANKUN__ && (tables.length > 0 || relationships.length > 0)) {
      const diagramData = {
        tables,
        relationships,
        database,
        timestamp: Date.now()
      };
      microBridge.dataChange(diagramData);
    }
  }, [tables, relationships, database]);

  const addTable = (data, addToHistory = true) => {
    const id = nanoid();
    if (data) {
      setTables((prev) => {
        const temp = prev.slice();
        temp.splice(data.index, 0, data);
        return temp;
      });
    } else {
      setTables((prev) => [
        ...prev,
        {
          id,
          name: `table_${prev.length}`,
          x: transform.pan.x,
          y: transform.pan.y,
          locked: false,
          fields: [
            {
              name: "id",
              type: database === DB.GENERIC ? "INT" : "INTEGER",
              default: "",
              check: "",
              primary: true,
              unique: true,
              notNull: true,
              increment: true,
              comment: "",
              id: nanoid(),
            },
          ],
          comment: "",
          indices: [],
          color: defaultBlue,
        },
      ]);
    }
    if (addToHistory) {
      setUndoStack((prev) => [
        ...prev,
        {
          id: data ? data.id : id,
          action: Action.ADD,
          element: ObjectType.TABLE,
          message: t("add_table"),
        },
      ]);
      setRedoStack([]);
    }
  };

  const deleteTable = (id, addToHistory = true) => {
    if (addToHistory) {
      const rels = relationships.reduce((acc, r) => {
        if (r.startTableId === id || r.endTableId === id) {
          acc.push(r);
        }
        return acc;
      }, []);
      const deletedTable = tables.find((t) => t.id === id);
      const deletedTableIndex = tables.findIndex((t) => t.id === id);
      setUndoStack((prev) => [
        ...prev,
        {
          action: Action.DELETE,
          element: ObjectType.TABLE,
          data: {
            table: deletedTable,
            relationship: rels,
            index: deletedTableIndex,
          },
          message: t("delete_table", { tableName: deletedTable.name }),
        },
      ]);
      setRedoStack([]);
      Toast.success(t("table_deleted"));
    }
    setRelationships((prevR) =>
      prevR.filter((e) => !(e.startTableId === id || e.endTableId === id)),
    );
    setTables((prev) => prev.filter((e) => e.id !== id));
    if (id === selectedElement.id) {
      setSelectedElement((prev) => ({
        ...prev,
        element: ObjectType.NONE,
        id: null,
        open: false,
      }));
    }
  };

  const updateTable = (id, updatedValues) => {
    setTables((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updatedValues } : t)),
    );
  };

  const updateField = (tid, fid, updatedValues) => {
    setTables((prev) =>
      prev.map((table) => {
        if (tid === table.id) {
          return {
            ...table,
            fields: table.fields.map((field) =>
              fid === field.id ? { ...field, ...updatedValues } : field,
            ),
          };
        }
        return table;
      }),
    );
  };

  const deleteField = (field, tid, addToHistory = true) => {
    const { fields, name } = tables.find((t) => t.id === tid);
    if (addToHistory) {
      const rels = relationships.reduce((acc, r) => {
        if (
          (r.startTableId === tid && r.startFieldId === field.id) ||
          (r.endTableId === tid && r.endFieldId === field.id)
        ) {
          acc.push(r);
        }
        return acc;
      }, []);
      setUndoStack((prev) => [
        ...prev,
        {
          action: Action.EDIT,
          element: ObjectType.TABLE,
          component: "field_delete",
          tid: tid,
          data: {
            field: field,
            index: fields.findIndex((f) => f.id === field.id),
            relationship: rels,
          },
          message: t("edit_table", {
            tableName: name,
            extra: "[delete field]",
          }),
        },
      ]);
      setRedoStack([]);
    }
    setRelationships((prev) =>
      prev.filter(
        (e) =>
          !(
            (e.startTableId === tid && e.startFieldId === field.id) ||
            (e.endTableId === tid && e.endFieldId === field.id)
          ),
      ),
    );
    updateTable(tid, {
      fields: fields.filter((e) => e.id !== field.id),
    });
  };

  const addRelationship = (data, addToHistory = true) => {
    if (addToHistory) {
      setRelationships((prev) => {
        setUndoStack((prevUndo) => [
          ...prevUndo,
          {
            action: Action.ADD,
            element: ObjectType.RELATIONSHIP,
            data: data,
            message: t("add_relationship"),
          },
        ]);
        setRedoStack([]);
        return [...prev, data];
      });
    } else {
      setRelationships((prev) => {
        const temp = prev.slice();
        temp.splice(data.id, 0, data);
        return temp.map((t, i) => ({ ...t, id: i }));
      });
    }
  };

  const deleteRelationship = (id, addToHistory = true) => {
    if (addToHistory) {
      setUndoStack((prev) => [
        ...prev,
        {
          action: Action.DELETE,
          element: ObjectType.RELATIONSHIP,
          data: relationships[id],
          message: t("delete_relationship", {
            refName: relationships[id].name,
          }),
        },
      ]);
      setRedoStack([]);
    }
    setRelationships((prev) =>
      prev.filter((e) => e.id !== id).map((e, i) => ({ ...e, id: i })),
    );
  };

  const updateRelationship = (id, updatedValues) => {
    setRelationships((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updatedValues } : t)),
    );
  };

  return (
    <DiagramContext.Provider
      value={{
        tables,
        setTables,
        addTable,
        updateTable,
        updateField,
        deleteField,
        deleteTable,
        relationships,
        setRelationships,
        addRelationship,
        deleteRelationship,
        updateRelationship,
        database,
        setDatabase,
        tablesCount: tables.length,
        relationshipsCount: relationships.length,
      }}
    >
      {children}
    </DiagramContext.Provider>
  );
}
