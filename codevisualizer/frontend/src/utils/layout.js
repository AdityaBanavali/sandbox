import dagre from 'dagre';

/**
 * Calculates deterministic graph layout using dagre.
 * Supports direction: 'TB' (Top-to-Bottom) or 'LR' (Left-to-Right).
 */
export const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: isHorizontal ? 50 : 70,
    ranksep: isHorizontal ? 80 : 80,
    align: 'DL',
    marginx: 40,
    marginy: 40,
  });

  nodes.forEach((node) => {
    // Approximate dimensions based on node structure
    const width = 260;
    const height = 110;
    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: isHorizontal ? 'left' : 'top',
      sourcePosition: isHorizontal ? 'right' : 'bottom',
      position: {
        x: nodeWithPosition.x - 130,
        y: nodeWithPosition.y - 55,
      },
    };
  });

  return { nodes: newNodes, edges };
};
