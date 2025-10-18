// LogicCircuitRenderer: Parses and renders boolean logic expressions as circuit diagrams on HTML5 canvas.
// Supports AND (&), OR (|), NOT (!), parentheses, and variable names.
// Usage examples:
//   LogicCircuitRenderer.render('A & (B | !C)', canvas);
//   LogicCircuitRenderer.render('Input1 | Input2 & !Output', canvas, { color: '#0074D9' });
//   LogicCircuitRenderer.render('!(A & B) | C', canvas, { font: '20px Arial' });

const RENDER_OPTIONS = {
    lineWidth: 2,
    gateHeight: 40,
    gateWidth: 40,    // Width of each logic gate
    hGap: 60,         // Horizontal gap between gate centers
    vGap: 50,         // Vertical gap between input variables
    inputStub: 3,     // Length of input wire before gate
    labelOffsetX: 15, // X offset for variable label
    labelPad: 5,      // Space between label and input wire
    outputStub: 25,   // Length of output wire after gate
    wireJog: 18,      // Horizontal jog for wire routing
    marginY: 20,      // Vertical margin around circuit
    minFlat: 10,      // Minimum flat segment for gate drawing
    font: '30px monospace',
    errorFont: '30px monospace',
    color: '#000000'
};

class LogicCircuitRenderer {
    static tokenize(input) {
        const tokens = [];
        const regex = /\s+|[A-Za-z_][A-Za-z0-9_]*|[()!&|]/g;
        let match;
        while ((match = regex.exec(input)) !== null) {
            const t = match[0];
            if (/^\s+$/.test(t)) continue;
            if (/^[A-Za-z_]/.test(t)) tokens.push({ type: 'VAR', value: t });
            else if (t === '(' || t === ')') tokens.push({ type: t });
            else if (t === '!') tokens.push({ type: 'NOT' });
            else if (t === '&') tokens.push({ type: 'AND' });
            else if (t === '|') tokens.push({ type: 'OR' });
            else throw new Error('Unsupported token: ' + t);
        }
        tokens.push({ type: 'EOF' });
        return tokens;
    }

    // Parses tokens into an abstract syntax tree (AST)
    static parseExpression(tokens) {
        let idx = 0;
        const peek = () => tokens[idx];
        const consume = (type) => {
            const token = tokens[idx];
            if (token.type !== type) throw new Error(`Expected ${type} but found ${token.type}`);
            idx++;
            return token;
        };

        const parsePrimary = () => {
            const token = peek();
            if (token.type === 'VAR') {
                consume('VAR');
                return { kind: 'VAR', name: token.value };
            }
            if (token.type === '(') {
                consume('(');
                const node = parseOr();
                if (peek().type !== ')') throw new Error('Missing closing )');
                consume(')');
                return node;
            }
            throw new Error(`Unexpected token: ${token.type}`);
        };

        const parseNot = () => {
            if (peek().type === 'NOT') {
                consume('NOT');
                return { kind: 'NOT', child: parseNot() };
            }
            return parsePrimary();
        };

        const parseAnd = () => {
            let node = parseNot();
            while (peek().type === 'AND') {
                consume('AND');
                node = { kind: 'AND', left: node, right: parseNot() };
            }
            return node;
        };

        const parseOr = () => {
            let node = parseAnd();
            while (peek().type === 'OR') {
                consume('OR');
                node = { kind: 'OR', left: node, right: parseAnd() };
            }
            return node;
        };

        const ast = parseOr();
        if (peek().type !== 'EOF') throw new Error('Unexpected trailing tokens');
        return ast;
    }

    // Draws the logic circuit for the given AST on the canvas
    static drawCircuit(canvas, ast, options = {}) {
        const opts = { ...RENDER_OPTIONS, ...options };
        const ctx = canvas.getContext('2d');

        const lineWidth = opts.lineWidth;
        const oddLine = (lineWidth % 2) !== 0;
        const align = (v) => (oddLine ? Math.round(v) + 0.5 : Math.round(v));
        const setColor = () => {
            ctx.strokeStyle = opts.color;
            ctx.fillStyle = opts.color;
        };
        const drawLine = (x1, y1, x2, y2) => {
            setColor();
            ctx.beginPath();
            ctx.moveTo(align(x1), align(y1));
            ctx.lineTo(align(x2), align(y2));
            ctx.stroke();
        };

        // Initialize drawing parameters
        let gateHeight = opts.gateHeight;
        let gateWidth = opts.gateWidth;
        let hGap = opts.hGap;
        let vGap = opts.vGap;
        let inputStub = opts.inputStub;
        let labelOffsetX = opts.labelOffsetX;
        let labelPad = opts.labelPad;
        let leftWireX = labelOffsetX + labelPad;
        let outputStub = opts.outputStub;
        let wireJog = opts.wireJog;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'bevel';
        ctx.miterLimit = 2;

        // Helper to compute the depth of the AST
        const getDepth = (node) =>
            node.kind === 'VAR' ? 0 :
                node.kind === 'NOT' ? 1 + getDepth(node.child) :
                    1 + Math.max(getDepth(node.left), getDepth(node.right));

        // Collects all variable leaves in the AST
        const getLeaves = (node, arr = []) => {
            if (!node) return arr;
            if (node.kind === 'VAR') arr.push(node);
            else if (node.kind === 'NOT') getLeaves(node.child, arr);
            else { getLeaves(node.left, arr); getLeaves(node.right, arr); }
            return arr;
        };

        const depth = getDepth(ast);
        const leaves = getLeaves(ast, []);

        const marginY = opts.marginY;

        // Calculate required width and height for the circuit
        const circuitWidth = (depth + 1) * hGap + 2 * (labelOffsetX + labelPad) + 40;
        const circuitHeight = Math.max(1, leaves.length) * vGap + 2 * marginY;

        // Scale circuit to fit canvas
        const scaleX = (canvas.width - 2) / circuitWidth;
        const scaleY = (canvas.height - 2) / circuitHeight;
        const scale = Math.min(scaleX, scaleY);

        // Apply scaling to all dimensions
        gateHeight *= scale;
        gateWidth *= scale;
        hGap *= scale;
        vGap *= scale;
        inputStub *= scale;
        labelOffsetX *= scale;
        labelPad *= scale;
        leftWireX = labelOffsetX + labelPad;
        outputStub *= scale;
        wireJog *= scale;

        // X positions for each depth level
        const xAtDepth = Array.from({ length: depth + 1 }, (_, i) => leftWireX + 6 + (depth - i) * hGap);

        let leafIndex = 0;
        const nodePos = new Map();
        // Assigns (x, y) positions to each node in the AST
        const assignPos = (node, d) => {
            if (node.kind === 'VAR') {
                const p = { x: xAtDepth[d], y: leafIndex * vGap };
                leafIndex++; nodePos.set(node, p); return p;
            }
            if (node.kind === 'NOT') {
                const childPos = assignPos(node.child, d + 1);
                const p = { x: xAtDepth[d], y: childPos.y };
                nodePos.set(node, p); return p;
            }
            const leftPos = assignPos(node.left, d + 1);
            const rightPos = assignPos(node.right, d + 1);
            const p = { x: xAtDepth[d], y: (leftPos.y + rightPos.y) / 2 };
            nodePos.set(node, p); return p;
        };
        assignPos(ast, 0);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        // Center the circuit in the canvas
        const offsetX = (canvas.width - (xAtDepth[0] + gateHeight / 2 + outputStub + 2 - labelOffsetX)) / 2;
        const offsetY = (canvas.height - (Math.max(1, leaves.length) * vGap + 2 * marginY)) / 2;
        ctx.translate(offsetX > 0 ? offsetX : 0, (offsetY > 0 ? offsetY : 0) + marginY);

        // Draws a wire with a horizontal jog for clarity
        const drawWire = (x1, y1, x2, y2, jog = 0) => {
            setColor();
            const mx = Math.min(x1 + wireJog + jog, x2 - (inputStub + 2));
            ctx.beginPath();
            ctx.moveTo(align(x1), align(y1));
            ctx.lineTo(align(mx), align(y1));
            ctx.lineTo(align(mx), align(y2));
            ctx.lineTo(align(x2), align(y2));
            ctx.stroke();
        };

        // Draws an AND gate at (x, y)
        const drawAnd = (x, y) => {
            setColor();
            const left = x - gateWidth / 2, right = x + gateWidth / 2, r = gateHeight / 2;
            const flat = Math.max(opts.minFlat * scale, right - r - left);
            ctx.beginPath();
            ctx.moveTo(left, y - gateHeight / 2);
            ctx.lineTo(left + flat, y - gateHeight / 2);
            ctx.arc(left + flat, y, r, -Math.PI / 2, Math.PI / 2, false);
            ctx.lineTo(left, y + gateHeight / 2);
            ctx.closePath(); ctx.stroke();

            const in1 = { x: left - inputStub, y: y - gateHeight / 4 };
            const in2 = { x: left - inputStub, y: y + gateHeight / 4 };
            const out = { x: right + inputStub, y };
            drawLine(left, in1.y, in1.x, in1.y);
            drawLine(left, in2.y, in2.x, in2.y);
            drawLine(right, y, out.x, out.y);
            return { in1, in2, out };
        };

        // Draws an OR gate at (x, y)
        const drawOr = (x, y) => {
            setColor();
            const left = x - gateWidth / 2, right = x + gateWidth / 2, r = gateHeight / 2;
            const flat = Math.max(opts.minFlat * scale, right - r - left);
            const top = y - gateHeight / 2, bottom = y + gateHeight / 2;
            const curve = 0.35 * gateHeight;

            const tipX = right + 0.18 * gateWidth;
            const tipY = y;

            ctx.beginPath();
            ctx.moveTo(left, top);
            ctx.lineTo(left + flat, top);
            ctx.quadraticCurveTo(right - r * 0.25, top, tipX, tipY);
            ctx.quadraticCurveTo(right - r * 0.25, bottom, left + flat, bottom);
            ctx.lineTo(left, bottom);
            ctx.quadraticCurveTo(left + curve, y, left, top);
            ctx.closePath();
            ctx.stroke();

            const backX = left + 0.375 * curve;
            const in1 = { x: left - inputStub, y: y - gateHeight / 4 };
            const in2 = { x: left - inputStub, y: y + gateHeight / 4 };
            const out = { x: tipX + inputStub, y };

            drawLine(backX, y - gateHeight / 4, left, y - gateHeight / 4); drawLine(left, y - gateHeight / 4, in1.x, in1.y);
            drawLine(backX, y + gateHeight / 4, left, y + gateHeight / 4); drawLine(left, y + gateHeight / 4, in2.x, in2.y);
            drawLine(tipX, y, out.x, out.y);

            return { in1, in2, out };
        };

        // Draws a NOT gate at (x, y)
        const drawNot = (x, y) => {
            setColor();
            const left = x - gateWidth / 2, right = x + gateWidth / 2;
            const bubbleR = Math.max(3 * scale, 0.12 * gateHeight);
            const tip = right - 2 * bubbleR;

            ctx.beginPath();
            ctx.moveTo(left, y - gateHeight / 2);
            ctx.lineTo(left, y + gateHeight / 2);
            ctx.lineTo(tip, y);
            ctx.closePath(); ctx.stroke();

            ctx.beginPath(); ctx.arc(right - bubbleR, y, bubbleR, 0, Math.PI * 2); ctx.stroke();

            const in1 = { x: left - inputStub, y };
            const out = { x: right + inputStub, y };
            drawLine(left, y, in1.x, in1.y);
            drawLine(right, y, out.x, out.y);
            return { in1, out };
        };

        // Draw variable labels and input wires
        ctx.font = opts.font;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        setColor();
        for (const leaf of leaves) {
            const p = nodePos.get(leaf);
            ctx.fillText(leaf.name, labelOffsetX, p.y);
            drawLine(leftWireX, p.y, p.x, p.y);
        }

        // Returns the output point of a node
        const getOutputPoint = (node) => {
            const p = nodePos.get(node);
            if (node.kind === 'VAR') return { x: p.x, y: p.y };
            return { x: p.x + gateWidth / 2, y: p.y };
        };

        const nodePorts = new Map();
        // Recursively draws gates and wires for the AST
        const drawNode = (node) => {
            const p = nodePos.get(node);
            if (node.kind === 'VAR') return;

            if (node.kind === 'NOT') {
                const childPort = nodePorts.get(node.child) || { out: getOutputPoint(node.child) };
                const here = drawNot(p.x, p.y);
                drawWire(childPort.out.x, childPort.out.y, here.in1.x, here.in1.y);
                nodePorts.set(node, { out: { x: here.out.x, y: here.out.y } });
                return;
            }

            const leftPort = nodePorts.get(node.left) || { out: getOutputPoint(node.left) };
            const rightPort = nodePorts.get(node.right) || { out: getOutputPoint(node.right) };
            const here = (node.kind === 'AND') ? drawAnd(p.x, p.y) : drawOr(p.x, p.y);
            drawWire(leftPort.out.x, leftPort.out.y, here.in1.x, here.in1.y);
            drawWire(rightPort.out.x, rightPort.out.y, here.in2.x, here.in2.y);
            nodePorts.set(node, { out: { x: here.out.x, y: here.out.y } });
        };

        // Traverses the AST in post-order to draw the circuit
        const traverse = (node) => {
            if (!node) return;
            if (node.kind === 'VAR') { drawNode(node); return; }
            if (node.kind === 'NOT') { traverse(node.child); drawNode(node); return; }
            traverse(node.left); traverse(node.right); drawNode(node);
        };
        traverse(ast);

        // Draw output wire from the root gate
        const root = nodePorts.get(ast)?.out || getOutputPoint(ast);
        setColor();
        ctx.beginPath(); ctx.moveTo(root.x, root.y); ctx.lineTo(root.x + outputStub, root.y); ctx.stroke();

        ctx.restore();
    }

    // Parses and renders the logic circuit, or displays an error if parsing fails
    static render(expression, canvas, options = {}) {
        let ast, error;
        try {
            ast = this.parseExpression(this.tokenize(expression));
            error = null;
        } catch (e) {
            ast = null;
            error = e.message;
        }

        const opts = { ...RENDER_OPTIONS, ...options };
        const ctx = canvas.getContext('2d');
        if (ast) {
            this.drawCircuit(canvas, ast, options);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = opts.color;
            ctx.fillStyle = opts.color;
            ctx.font = opts.errorFont;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText('Parse error: ' + error, 16, 16);
        }
    }
}
