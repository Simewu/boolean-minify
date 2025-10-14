# Boolean Expression Minimization

```console
Canonical form: A standard representation used to demonstrate equivalence between different forms.
```

This browser-based tool simplifies Boolean expressions by converting them to their canonical form. It accepts a JavaScript oracle function, truth table, or DIMACS SAT instance (DNF or CNF) and produces a minimized JavaScript function, truth table, DIMACS SAT instance, logic circuit diagram, or Karnaugh map.

![](lib/screenshot.png)

Minimization uses the Quine-McCluskey algorithm, which is NP-complete and runs in exponential time complexity.

## Logic Circuit Renderer

A minimal rendering library (`logicCircuitRenderer.js`) is included for drawing schematic diagrams. For example usage, see `logicCircuitRenderer_example.html`.
