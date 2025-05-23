import React, { useCallback, useEffect, useState } from "react";
import { Edge, Handle, Position, useUpdateNodeInternals } from "reactflow";
import { Badge, Text } from "@mantine/core";
import useStore from "./store";
import { IconSettings, IconImageInPicture } from "@tabler/icons-react";
import { extractTemplateVars } from "./backend/template";
import { IMAGE_COLUMN } from "./MediaNode";

const SETTINGS_ICON = (
  <IconSettings
    size="14px"
    style={{ paddingTop: "2px", marginLeft: "2px", marginRight: "0px" }}
  />
);

const IMAGE_ICON = (
  <IconImageInPicture
    size="14px"
    style={{ paddingTop: "2px", marginLeft: "2px", marginRight: "0px" }}
  />
);

export const extractBracketedSubstrings = (text: string) => {
  /** Given some text in template format:
   *      This is a {test}
   *  extracts only the groups within braces, excluding
   *  any escaped braces \{ \}.
   *
   *  NOTE: We don't use Regex here for compatibility of browsers
   *  that don't support negative lookbehinds/aheads (e.g., Safari).
   */
  let capture_groups: Array<string> = [];
  for (const v of extractTemplateVars(text)) capture_groups.push(v);

  // Ignore any varnames that begin with the special character #:
  capture_groups = capture_groups.filter((s) => s.length === 0 || s[0] !== "#");

  return capture_groups;
};

export interface TemplateHooksProps {
  vars: string[];
  nodeId: string;
  startY: number;
  position: Position;
  ignoreHandles?: string[];
}

export default function TemplateHooks({
  vars,
  nodeId,
  startY,
  position,
  ignoreHandles,
}: TemplateHooksProps) {
  const edges = useStore((state) => state.edges);
  const onEdgesChange = useStore((state) => state.onEdgesChange);
  const [edgesToRemove, setEdgesToRemove] = useState<Edge[]>([]);

  // For notifying the backend when we re-render Handles:
  const updateNodeInternals = useUpdateNodeInternals();

  // Remove edges whenever a template variable changes
  useEffect(() => {
    onEdgesChange(edgesToRemove.map((e) => ({ id: e.id, type: "remove" })));
  }, [edgesToRemove]);

  const genTemplateHooks = useCallback(
    (temp_var_names: string[], names_to_blink: string[]) => {
      // Generate handles
      const pos = position !== undefined ? position : Position.Left;
      const handle_type = pos === Position.Left ? "target" : "source";
      return temp_var_names.map((name, idx) => {
        const is_settings_var = name.charAt(0) === "=";
        let color = is_settings_var ? "orange" : "indigo";
        // check if we are on a Media Node and if the name is 'Image'
        const is_image_var =
          name === IMAGE_COLUMN.header && nodeId.startsWith("media");
        let badge_name = is_settings_var ? (
          <Text display="flex" align="center">
            {name.substring(1)} {SETTINGS_ICON}
          </Text>
        ) : (
          name
        );
        if (is_image_var) {
          badge_name = (
            <Text display="flex" align="center">
              {name} {IMAGE_ICON}
            </Text>
          );
          color = "yellow";
        }
        const className = names_to_blink.includes(name)
          ? "hook-tag text-blink"
          : "hook-tag";
        const style = { top: idx * 28 + startY + "px", background: "#555" };
        return (
          <div
            key={name}
            className={className}
            style={{ display: "flex", justifyContent: pos }}
          >
            <Badge
              color={color}
              size="md"
              radius="sm"
              style={{ textTransform: "none" }}
            >
              {badge_name}
            </Badge>
            <Handle
              type={handle_type}
              position={pos}
              id={name}
              key={name}
              style={style}
            />
          </div>
        );
      });
    },
    [startY, position],
  );

  const [templateHooks, setTemplateHooks] = useState<React.ReactNode[]>([]);

  useEffect(() => {
    // Determine if there's any handles that were deleted in temp_var_names,
    // and manually remove them as edges:
    if (templateHooks.length > 0) {
      const deleted_edges: Edge[] = [];
      edges.forEach((e) => {
        if (
          !(
            e.target !== nodeId ||
            (typeof e.targetHandle === "string" &&
              (vars.includes(e.targetHandle) ||
                (ignoreHandles &&
                  Array.isArray(ignoreHandles) &&
                  ignoreHandles.includes(e.targetHandle))))
          )
        )
          deleted_edges.push(e);
      });

      if (deleted_edges.length > 0) setEdgesToRemove(deleted_edges);
    }

    setTemplateHooks(genTemplateHooks(vars, []));

    // setDataPropsForNode(nodeId, {vars: vars});
  }, [vars, startY, genTemplateHooks, nodeId, ignoreHandles]);

  // Because of the way React flow internally stores Handles,
  // we need to notify it to update its backend representation of the 'node'
  // this TemplateHooks component is on, so it re-checks the Handles subcomponents.
  // :: See https://github.com/wbkd/react-flow/issues/805#issuecomment-788097022
  useEffect(() => {
    updateNodeInternals(nodeId);
  }, [templateHooks]);

  return <div className="template-hooks">{templateHooks}</div>;
}
