import ast
import re
from typing import List, Dict, Set, Tuple
from ..schemas import GraphNode, GraphEdge, NodeData, NodePosition, VisualizeResponse, VisualizeStats

class FallbackParser:
    """
    Intelligent heuristic and AST-based parser that generates rich architecture
    and control flow diagrams without requiring an external LLM API key.
    """

    @classmethod
    def parse(cls, code: str, language: str = "python", mode: str = "architecture") -> VisualizeResponse:
        language = (language or "python").lower()
        if language in ("python", "py"):
            try:
                return cls._parse_python(code, mode)
            except Exception:
                # Fallback to regex parser if AST parsing encounters a syntax error
                return cls._parse_generic(code, language, mode)
        else:
            return cls._parse_generic(code, language, mode)

    @classmethod
    def _parse_python(cls, code: str, mode: str) -> VisualizeResponse:
        lines = code.splitlines()
        tree = ast.parse(code)

        nodes: List[GraphNode] = []
        edges: List[GraphEdge] = []
        node_id_map: Dict[str, str] = {}
        calls_map: List[Tuple[str, str, str]] = []  # (caller, callee, label)
        node_counter = 1

        # First pass: collect classes and functions
        class Visitor(ast.NodeVisitor):
            def __init__(self):
                self.current_scope = None

            def visit_ClassDef(self, node: ast.ClassDef):
                nonlocal node_counter
                node_id = f"node_{node_counter}"
                node_counter += 1
                node_id_map[node.name] = node_id

                # Extract class snippet preview
                start = max(0, node.lineno - 1)
                end = min(len(lines), getattr(node, "end_lineno", node.lineno + 5))
                snippet = "\n".join(lines[start:end])

                bases = [ast.unparse(b) for b in node.bases] if hasattr(ast, "unparse") else []
                desc = f"Class inheriting from {', '.join(bases)}" if bases else "Class definition"

                # Check if it looks like a DB model or Service
                category = "db" if any("model" in b.lower() or "base" in b.lower() or "entity" in b.lower() for b in bases) else "service"
                node_type = "dbNode" if category == "db" else "serviceNode"

                nodes.append(GraphNode(
                    id=node_id,
                    type=node_type,
                    data=NodeData(
                        label=node.name,
                        category=category,
                        description=desc,
                        snippet=snippet,
                        badge="MODEL" if category == "db" else "CLASS",
                        tags=["Class", "OOP"] + bases,
                        params=bases
                    )
                ))

                old_scope = self.current_scope
                self.current_scope = node.name
                self.generic_visit(node)
                self.current_scope = old_scope

            def visit_FunctionDef(self, node: ast.FunctionDef):
                self._handle_func(node, is_async=False)

            def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
                self._handle_func(node, is_async=True)

            def _handle_func(self, node, is_async: bool):
                nonlocal node_counter
                func_name = node.name
                node_id = f"node_{node_counter}"
                node_counter += 1
                node_id_map[func_name] = node_id

                # Inspect decorators for API routes (FastAPI / Flask)
                http_method = None
                route_path = None
                for dec in node.decorator_list:
                    dec_str = ast.unparse(dec) if hasattr(ast, "unparse") else ""
                    m = re.search(r"\.(get|post|put|delete|patch|route)\((['\"])(.*?)\2", dec_str, re.IGNORECASE)
                    if m:
                        http_method = m.group(1).upper()
                        route_path = m.group(3)
                        break

                params = [a.arg for a in node.args.args]
                start = max(0, node.lineno - 1)
                end = min(len(lines), getattr(node, "end_lineno", node.lineno + 8))
                snippet = "\n".join(lines[start:end])

                if http_method:
                    category = "api"
                    node_type = "apiNode"
                    label = f"{http_method} {route_path or '/' + func_name}"
                    badge = http_method
                    desc = f"API Route handler in function {func_name}"
                elif func_name.startswith("db_") or "query" in func_name or "save" in func_name or "repo" in func_name:
                    category = "db"
                    node_type = "dbNode"
                    label = func_name
                    badge = "DB QUERY"
                    desc = f"Database operation function {func_name}"
                elif any(word in func_name.lower() for word in ["validate", "check", "verify", "is_"]):
                    category = "decision"
                    node_type = "decisionNode"
                    label = func_name
                    badge = "VALIDATION"
                    desc = f"Validation / logic gate: {func_name}"
                else:
                    category = "function"
                    node_type = "functionNode"
                    label = func_name
                    badge = "ASYNC" if is_async else "DEF"
                    desc = f"Function {func_name}({', '.join(params[:3])})"

                nodes.append(GraphNode(
                    id=node_id,
                    type=node_type,
                    data=NodeData(
                        label=label,
                        category=category,
                        description=desc,
                        snippet=snippet,
                        badge=badge,
                        tags=["Async" if is_async else "Sync", category.capitalize()],
                        params=params
                    )
                ))

                old_scope = self.current_scope
                self.current_scope = func_name

                # Scan function body for calls to other functions
                for child in ast.walk(node):
                    if isinstance(child, ast.Call):
                        callee_name = None
                        if isinstance(child.func, ast.Name):
                            callee_name = child.func.id
                        elif isinstance(child.func, ast.Attribute):
                            callee_name = child.func.attr
                        if callee_name and callee_name != func_name:
                            calls_map.append((func_name, callee_name, "calls"))

                self.current_scope = old_scope

        visitor = Visitor()
        visitor.visit(tree)

        # Connect edges based on discovered calls
        edge_set: Set[Tuple[str, str]] = set()
        edge_id = 1
        for caller, callee, label in calls_map:
            src_id = node_id_map.get(caller)
            tgt_id = node_id_map.get(callee)
            if src_id and tgt_id and src_id != tgt_id and (src_id, tgt_id) not in edge_set:
                edge_set.add((src_id, tgt_id))
                edges.append(GraphEdge(
                    id=f"e_{src_id}_{tgt_id}_{edge_id}",
                    source=src_id,
                    target=tgt_id,
                    label=label,
                    animated=True,
                    type="smoothstep"
                ))
                edge_id += 1

        # If sparse connections, add sequential flow between API/entrypoints and subsequent handlers
        if len(edges) == 0 and len(nodes) > 1:
            for i in range(len(nodes) - 1):
                edges.append(GraphEdge(
                    id=f"e_{nodes[i].id}_{nodes[i+1].id}",
                    source=nodes[i].id,
                    target=nodes[i+1].id,
                    label="flows to",
                    animated=True,
                    type="smoothstep"
                ))

        summary = f"Parsed Python program containing {len(nodes)} primary architectural components and {len(edges)} control flow relationships."
        stats = VisualizeStats(
            components=len(nodes),
            connections=len(edges),
            complexity="High" if len(nodes) > 6 else ("Medium" if len(nodes) > 3 else "Low"),
            language="Python"
        )

        return VisualizeResponse(
            nodes=nodes,
            edges=edges,
            summary=summary,
            stats=stats,
            provider_used="ast_fallback"
        )

    @classmethod
    def _parse_generic(cls, code: str, language: str, mode: str) -> VisualizeResponse:
        nodes: List[GraphNode] = []
        edges: List[GraphEdge] = []
        node_id_map: Dict[str, str] = {}
        lines = code.splitlines()
        node_counter = 1

        # Regex patterns to detect methods, functions, endpoints, classes, components
        patterns = [
            # React components: function MyComp() or const MyComp = () =>
            (r"(?:export\s+default\s+|export\s+)?(?:function|const)\s+([A-Z][a-zA-Z0-9_]*)\s*(?:=\s*(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>|\()", "component", "serviceNode", "REACT COMP"),
            # API routes: app.get('/path'), router.post(...)
            (r"(?:app|router)\.(get|post|put|delete|patch)\(\s*(['\"`])(.*?)\2", "api", "apiNode", "HTTP"),
            # JS/TS functions: function foo(), async function foo(), const foo = async () =>
            (r"(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\((.*?)\)", "function", "functionNode", "FUNCTION"),
            (r"(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\((.*?)\)\s*=>", "function", "functionNode", "ARROW FUNC"),
            # Classes
            (r"class\s+([a-zA-Z0-9_]+)(?:\s+extends\s+([a-zA-Z0-9_]+))?", "class", "serviceNode", "CLASS"),
            # Database queries or models
            (r"(?:const|let|var)\s+([a-zA-Z0-9_]*(?:Schema|Model|Repository|Store|DB|Table))\b", "db", "dbNode", "DATABASE"),
        ]

        found_items = []
        for idx, line in enumerate(lines):
            for pattern, cat, ntype, default_badge in patterns:
                m = re.search(pattern, line)
                if m:
                    if cat == "api":
                        method = m.group(1).upper()
                        path = m.group(3)
                        name = f"{method} {path}"
                        badge = method
                    elif cat == "class":
                        name = m.group(1)
                        badge = f"EXTENDS {m.group(2)}" if m.group(2) else "CLASS"
                    else:
                        name = m.group(1)
                        badge = default_badge

                    if name not in [item[0] for item in found_items]:
                        snippet = "\n".join(lines[idx:min(len(lines), idx + 7)])
                        found_items.append((name, cat, ntype, badge, snippet, idx))
                    break

        # If regex didn't catch anything, create fallback nodes for sections of code
        if not found_items:
            chunk_size = max(1, len(lines) // 3)
            for i in range(0, min(3, max(1, (len(lines) + chunk_size - 1) // chunk_size))):
                start_l = i * chunk_size
                end_l = min(len(lines), (i + 1) * chunk_size)
                chunk_snippet = "\n".join(lines[start_l:end_l])
                name = f"Block {i+1}"
                found_items.append((name, "function", "functionNode", "LOGIC", chunk_snippet, start_l))

        for name, cat, ntype, badge, snippet, line_idx in found_items:
            node_id = f"node_{node_counter}"
            node_counter += 1
            node_id_map[name] = node_id

            nodes.append(GraphNode(
                id=node_id,
                type=ntype,
                data=NodeData(
                    label=name,
                    category=cat,
                    description=f"{cat.capitalize()} extracted from line {line_idx + 1}",
                    snippet=snippet,
                    badge=badge,
                    tags=[language.capitalize(), cat.capitalize()]
                )
            ))

        # Check call references in code
        edge_set = set()
        edge_id = 1
        for name, src_id in node_id_map.items():
            clean_name = name.split()[-1] if " " in name else name
            for other_name, tgt_id in node_id_map.items():
                if src_id == tgt_id:
                    continue
                clean_target = other_name.split()[-1] if " " in other_name else other_name
                # Check if other_name is invoked in the source code
                if re.search(r"\b" + re.escape(clean_target) + r"\s*\(", code):
                    if (src_id, tgt_id) not in edge_set:
                        edge_set.add((src_id, tgt_id))
                        edges.append(GraphEdge(
                            id=f"e_{src_id}_{tgt_id}_{edge_id}",
                            source=src_id,
                            target=tgt_id,
                            label="invokes",
                            animated=True,
                            type="smoothstep"
                        ))
                        edge_id += 1

        # Chain if sparse
        if len(edges) == 0 and len(nodes) > 1:
            for i in range(len(nodes) - 1):
                edges.append(GraphEdge(
                    id=f"e_{nodes[i].id}_{nodes[i+1].id}",
                    source=nodes[i].id,
                    target=nodes[i+1].id,
                    label="flows to",
                    animated=True,
                    type="smoothstep"
                ))

        return VisualizeResponse(
            nodes=nodes,
            edges=edges,
            summary=f"Parsed {language.capitalize()} code with {len(nodes)} modules and {len(edges)} dependencies.",
            stats=VisualizeStats(
                components=len(nodes),
                connections=len(edges),
                complexity="Medium" if len(nodes) > 3 else "Low",
                language=language.capitalize()
            ),
            provider_used="regex_fallback"
        )
