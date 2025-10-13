class BinomialCoefficients {
    static pascalTableCache = new Map();
    static bitWeightsCache = new Map();

    // Generate Pascal's triangle table for binomial coefficients (BigInt)
    static pascalTable(n, k) {
        const key = n + '|' + k;
        const cached = BinomialCoefficients.pascalTableCache.get(key);
        if (cached) return cached;
        const table = Array.from({ length: n + 1 }, () => Array(k + 1).fill(0n));
        for (let i = 0; i <= n; i++) {
            table[i][0] = 1n;
            for (let j = 1; j <= Math.min(i, k); j++) {
                table[i][j] = (j === i) ? 1n : table[i - 1][j - 1] + table[i - 1][j];
            }
        }
        BinomialCoefficients.pascalTableCache.set(key, table);
        return table;
    }

    static bitWeights(n) {
        const hit = BinomialCoefficients.bitWeightsCache.get(n);
        if (hit) return hit;
        const weights = Array.from({ length: n }, (_, i) => 1n << BigInt(n - 1 - i));
        BinomialCoefficients.bitWeightsCache.set(n, weights);
        return weights;
    }

    static unrankLex(n, k, rank, pascalTable) {
        let remainingRank = BigInt(rank);
        const indices = new Array(k);
        let start = 0;
        for (let placed = 0; placed < k; placed++) {
            const remaining = k - placed - 1;
            let lo = start, hi = n - (remaining + 1), ans = start;
            while (lo <= hi) {
                const mid = Math.floor((lo + hi) / 2);
                const count = pascalTable[n - (mid + 1)][remaining];
                if (count > remainingRank) { ans = mid; hi = mid - 1; }
                else { remainingRank -= count; lo = mid + 1; }
            }
            indices[placed] = ans;
            start = ans + 1;
        }
        return indices;
    }

    static nextCombination(indices, n) {
        const k = indices.length;
        let i = k - 1;
        while (i >= 0 && indices[i] === i + (n - k)) i--;
        if (i < 0) return null;
        indices[i]++;
        for (let j = i + 1; j < k; j++) {
            indices[j] = indices[j - 1] + 1;
        }
        return indices;
    }

    static nextCombinationAndPatch(indices, n, bits, weights, box) {
        const k = indices.length;
        let i = k - 1;
        while (i >= 0 && indices[i] === i + (n - k)) i--;
        if (i < 0) return null;
        for (let j = k - 1; j >= i; j--) {
            const pos = indices[j];
            if (bits[pos] === 1) {
                bits[pos] = 0;
                box.value -= weights[pos];
            }
        }
        indices[i]++;
        bits[indices[i]] = 1;
        box.value += weights[indices[i]];
        for (let j = i + 1; j < k; j++) {
            indices[j] = indices[j - 1] + 1;
            bits[indices[j]] = 1;
            box.value += weights[indices[j]];
        }
        return indices;
    }

    static indicesToBits(n, indices) {
        const bits = Array(n).fill(0);
        for (let i = 0; i < indices.length; i++) bits[indices[i]] = 1;
        return bits;
    }

    // Generator: yield combinations passing oracle filter
    static *filterGenerator(n, k, oracleFunction) {
        const includeBits = true;
        const pascalTable = BinomialCoefficients.pascalTable(n, k);
        const total = pascalTable[n][k];
        if (k < 0 || k > n || total === 0n) return;

        let start = 0n;
        let end = total;

        let indices = BinomialCoefficients.unrankLex(n, k, start, pascalTable);

        const bits = new Uint8Array(n);
        const weights = BinomialCoefficients.bitWeights(n);
        const box = { value: 0n };
        for (let t = 0; t < indices.length; t++) {
            const p = indices[t];
            bits[p] = 1;
            box.value += weights[p];
        }

        for (let r = start; r < end; r++) {
            let oracleResult = false;
            try {
                oracleResult = oracleFunction(...Array.from(bits, b => b === 1));
            } catch (e) {
                oracleResult = false;
                error(e);
                return;
            }
            if (oracleResult === true || oracleResult === undefined) {
                yield {
                    value: box.value,
                    bits: includeBits ? bits.join('') : undefined,
                    oracleResponse: oracleResult === true ? true : undefined,
                    rank: r
                };
            }
            if (r + 1n === end) break;
            if (BinomialCoefficients.nextCombinationAndPatch(indices, n, bits, weights, box) === null) break;
        }
    }

    static filter(n, k, oracleFunction) {
        const result = [];
        for (const item of BinomialCoefficients.filterGenerator(n, k, oracleFunction)) {
            result.push(item);
        }
        return result;
    }

    static getBitString(n, k, i) {
        const pascalTable = BinomialCoefficients.pascalTable(n, k);
        const indices = BinomialCoefficients.unrankLex(n, k, i, pascalTable);
        return BinomialCoefficients.indicesToBits(n, indices).join('');
    }
}

class QuineMcCluskey {

    static defaultVarNames(n) {
        const out = [];
        for (let i = 0; i < n; i++) {
            let s = '', x = i;
            while (x >= 0) {
                const rem = x % 26;
                s = String.fromCharCode(65 + rem) + s;
                x = Math.floor(x / 26) - 1;
            }
            out.push(s);
        }
        return out;
    }

    static toBitString(n, value) {
        return value.toString(2).padStart(n, '0');
    }

    static countSetBits(bitPattern) {
        let count = 0;
        for (let i = 0; i < bitPattern.length; i++) if (bitPattern[i] === '1') count++;
        return count;
    }

    static getEssentialPrimeImplicants(chart) {
        const coverageRows = [...chart.values()];
        const implicantPatterns = [...chart.keys()];
        if (!coverageRows.length) return [];
        const columnCount = coverageRows[0].length;
        const essentialPatterns = new Set();

        for (let colIndex = 0; colIndex < columnCount; colIndex++) {
            let implicantCoverCount = 0;
            let lastCoveringRowIndex = -1;

            for (let rowIndex = 0; rowIndex < coverageRows.length; rowIndex++) {
                if (coverageRows[rowIndex][colIndex] === '1') {
                    implicantCoverCount++;
                    lastCoveringRowIndex = rowIndex;
                    if (implicantCoverCount > 1) break;
                }
            }
            if (implicantCoverCount === 1) {
                essentialPatterns.add(implicantPatterns[lastCoveringRowIndex]);
            }
        }
        return [...essentialPatterns];
    }

    static mergeIfOneBitApart(firstBits, secondBits) {
        if (firstBits.length !== secondBits.length) return null;
        let diffCount = 0;
        const merged = [];
        for (let i = 0; i < firstBits.length; i++) {
            const a = firstBits[i], b = secondBits[i];
            if (a === b) {
                merged.push(a);
                continue;
            }
            if (a === '-' || b === '-') return null;
            diffCount++;
            if (diffCount > 1) return null;
            merged.push('-');
        }
        return diffCount === 1 ? merged.join('') : null;
    }

    static mergeOneBitPass(implicants) {
        for (const implicant of implicants) implicant.used = false;

        const termsByOneCount = new Map();
        for (const implicant of implicants) {
            const oneCount = QuineMcCluskey.countSetBits(implicant.bits);
            if (!termsByOneCount.has(oneCount)) termsByOneCount.set(oneCount, []);
            termsByOneCount.get(oneCount).push(implicant);
        }

        const sortedWeights = Array.from(termsByOneCount.keys()).sort((a, b) => a - b);
        const mergedTermsByBits = new Map();
        const parentToMergedChildren = new Map();

        const registerParentChild = (parentBits, childTerm) => {
            let arr = parentToMergedChildren.get(parentBits);
            if (!arr) parentToMergedChildren.set(parentBits, (arr = []));
            arr.push(childTerm);
        };

        const recordMergedTerm = (bits, sourceMinterms) => {
            let merged = mergedTermsByBits.get(bits);
            if (!merged) {
                merged = { bits, minterms: new Set(sourceMinterms), used: false };
                mergedTermsByBits.set(bits, merged);
            } else {
                for (const m of sourceMinterms) merged.minterms.add(m);
            }
            return merged;
        };

        for (let i = 0; i < sortedWeights.length - 1; i++) {
            const currentGroup = termsByOneCount.get(sortedWeights[i]);
            const nextGroup = termsByOneCount.get(sortedWeights[i + 1]);
            if (!currentGroup || !nextGroup) continue;
            for (const left of currentGroup) {
                for (const right of nextGroup) {
                    const mergedBits = QuineMcCluskey.mergeIfOneBitApart(left.bits, right.bits);
                    if (!mergedBits) continue;
                    left.used = right.used = true;
                    const combinedMinterms = new Set(left.minterms);
                    for (const m of right.minterms) combinedMinterms.add(m);
                    const child = recordMergedTerm(mergedBits, combinedMinterms);
                    registerParentChild(left.bits, child);
                    registerParentChild(right.bits, child);
                }
            }
        }

        return {
            mergedTermsNextLevel: Array.from(mergedTermsByBits.values()),
            primeTermsThisLevel: implicants.filter(t => !t.used),
            parentToMergedChildren
        };
    }

    static buildImplicantLevels(initialImplicants) {
        const levels = [];
        let currentLevelImplicants = initialImplicants;
        while (currentLevelImplicants.length) {
            const mergePass = QuineMcCluskey.mergeOneBitPass(currentLevelImplicants);
            const primeImplicantBits = new Set(mergePass.primeTermsThisLevel.map(t => t.bits));
            levels.push({
                terms: currentLevelImplicants.slice().sort((a, b) => a.bits.localeCompare(b.bits)),
                primeSet: primeImplicantBits
            });
            if (!mergePass.mergedTermsNextLevel.length) break;
            currentLevelImplicants = mergePass.mergedTermsNextLevel;
        }
        return levels;
    }

    // Create an oracle function that returns the complement of the given oracle function
    static oracleForComplement(oracleFunction) {
        return (...inputBits) => {
            let v = false;
            try {
                v = oracleFunction(...inputBits);
            } catch (e) {}
            if (v === undefined) return undefined;
            return (v === false);
        };
    }

    // Count non-don't-care literals in a pattern
    static countLiteralsInPattern(pattern) {
        let c = 0;
        for (let i = 0; i < pattern.length; i++) if (pattern[i] !== '-') c++;
        return c;
    }

    // Petrick's method: Given a coverage chart (Map of rowKey -> bitstring), a list of column indices to cover, and a set of rows to exclude, find minimal set of rows whose union covers all specified columns
    static petrickMinCover(coverageChart, columnsToCover, excludeRows) {
        const rowKeys = [...coverageChart.keys()].filter(k => !excludeRows.has(k));
        // For each column, collect rows that cover it
        const sums = columnsToCover.map(col => {
            const options = [];
            for (const r of rowKeys) {
                const bits = coverageChart.get(r) || '';
                if (bits[col] === '1') options.push(r);
            }
            return options;
        });
        // If any column is uncovered, return empty set
        for (const opts of sums) {
            if (!opts.length) {
                return new Set();
            }
        }

        // Expand all products pruning supersets at each step
        let products = [new Set()];
        for (const options of sums) {
            const next = [];
            for (const prod of products) {
                for (const r of options) {
                    const s = new Set(prod);
                    s.add(r);
                    next.push(s);
                }
            }
            // Remove supersets keeping only minimal sets
            const canonical = next.map(s => Array.from(s).sort());
            const keep = new Array(canonical.length).fill(true);
            for (let i = 0; i < canonical.length; i++) {
                if (!keep[i]) continue;
                for (let j = 0; j < canonical.length; j++) {
                    if (i === j || !keep[j]) continue;
                    // Drop i if j is a subset of i
                    let subset = true;
                    const a = canonical[j], b = canonical[i];
                    let p = 0, q = 0;
                    while (p < a.length && q < b.length) {
                        if (a[p] === b[q]) {
                            p++;
                            q++;
                        } else if (a[p] < b[q]) {
                            subset = false;
                            break;
                        } else if (a[p] < b[q]) {
                            subset = false;
                            break;
                        } else {
                            q++;
                        }
                    }
                    if (subset && p === a.length && b.length >= a.length) {
                        keep[i] = false;
                        break;
                    }
                }
            }
            products = [];
            for (let i = 0; i < canonical.length; i++) {
                if (keep[i]) {
                    products.push(new Set(canonical[i]));
                }
            }
        }

        // Select by fewest rows, then fewest literals, then lexicographically
        let best = null;
        let bestKey = null;
        const literalCostCache = new Map();
        const getCost = (row) => {
            let c = literalCostCache.get(row);
            if (c !== undefined) return c;
            c = QuineMcCluskey.countLiteralsInPattern(row);
            literalCostCache.set(row, c);
            return c;
        };
        for (const s of products) {
            const arr = Array.from(s).sort();
            const card = arr.length;
            let litCost = 0;
            for (const r of arr) {
                litCost += getCost(r);
            }
            const key = JSON.stringify([card, litCost, arr]);
            if (best === null || key < bestKey) {
                best = new Set(arr);
                bestKey = key;
            }
        }
        return best || new Set();
    }

    static solveCNF(variableNames, oracleFunction) {
        const maxterms = [];
        const initialImplicants = [];

        const numVariables = variableNames.length;
        for (let weight = 0; weight <= numVariables; weight++) {
            for (const item of BinomialCoefficients.filterGenerator(numVariables, weight, QuineMcCluskey.oracleForComplement(oracleFunction))) {
                const bitPattern = item.bits;
                const numericValue = Number(item.value);
                const isMaxterm = (item.oracleResponse === true);
                if (isMaxterm) maxterms.push(numericValue);
                initialImplicants.push({
                    bits: bitPattern,
                    minterms: new Set(isMaxterm ? [numericValue] : []),
                    used: false
                });
            }
        }

        const implicantLevels = QuineMcCluskey.buildImplicantLevels(initialImplicants);

        const allPrimeBits = new Set();
        for (const lvl of implicantLevels) {
            for (const b of lvl.primeSet) allPrimeBits.add(b);
        }
        const primeImplicantsBits = Array.from(allPrimeBits).sort();

        const maxtermsSorted = [...maxterms].sort((a, b) => a - b);
        const maxtermBinaryStrings = maxtermsSorted.map(v => QuineMcCluskey.toBitString(numVariables, v));
        const coverageChart = new Map();
        for (const implicantPattern of primeImplicantsBits) {
            const patternRegex = new RegExp('^' + implicantPattern.replace(/-/g, '[01]') + '$');
            const coverageBits = maxtermBinaryStrings.map(binStr => (patternRegex.test(binStr) ? '1' : '0')).join('');
            coverageChart.set(implicantPattern, coverageBits);
        }

        const essentialBits = new Set(QuineMcCluskey.getEssentialPrimeImplicants(coverageChart));

        const clauseFromPattern = (pattern) => {
            const jsTokens = [];
            for (let i = 0; i < pattern.length; i++) {
                const bit = pattern[i];
                if (bit === '-') continue;
                const varName = variableNames[i] || ('V' + i);
                jsTokens.push(bit === '0' ? varName : '!' + varName);
            }
            if (!jsTokens.length) return ''; // Empty clause is false
            if (jsTokens.length === 1) return jsTokens[0];
            return jsTokens.join(' || ');
        };

        const primeImplicantsExpanded = primeImplicantsBits.map(pattern => {
            const coverageBits = coverageChart.get(pattern) || '';
            const covers = [];
            for (let i = 0; i < coverageBits.length; i++) {
                if (coverageBits[i] === '1') {
                    covers.push(maxtermsSorted[i]);
                }
            }
            return {
                pattern,
                jsClause: clauseFromPattern(pattern),
                covers,
                essential: essentialBits.has(pattern)
            };
        }).sort((a, b) => a.pattern.localeCompare(b.pattern));

        const essentialExpanded = primeImplicantsExpanded.filter(pi => pi.essential);
        const essentialSet = new Set(essentialExpanded.map(pi => pi.pattern));

        // Remove columns covered by essentials; solve remaining with Petrick's method (rows are prime implicates of F)
        const coveredByEssentials = new Set();
        for (let col = 0; col < maxtermsSorted.length; col++) {
            for (const pi of essentialExpanded) {
                const bits = coverageChart.get(pi.pattern) || '';
                if (bits[col] === '1') {
                    coveredByEssentials.add(col);
                    break;
                }
            }
        }
        const toCover = [];
        for (let col = 0; col < maxtermsSorted.length; col++) if (!coveredByEssentials.has(col)) toCover.push(col);
        const petrickChosen = (toCover.length ? QuineMcCluskey.petrickMinCover(coverageChart, toCover, essentialSet) : new Set());
        const chosenSet = new Set([...essentialSet, ...petrickChosen]);
        const chosenExpanded = primeImplicantsExpanded.filter(pi => chosenSet.has(pi.pattern));

        // If there are no maxterms (tautology) then CNF is true; if any chosen clause is empty (all '-') then CNF is false
        const hasEmptyClause = chosenExpanded.some(pi => pi.jsClause === '');
        let jsExpression;
        if (hasEmptyClause) {
            jsExpression = 'false';
        } else if (maxtermsSorted.length === 0) {
            jsExpression = 'true';
        } else {
            const partsRaw = chosenExpanded.map(pi => pi.jsClause);
            if (partsRaw.length === 1) {
                // Single clause
                jsExpression = partsRaw[0];
            } else {
                // Multiple clauses
                const parts = partsRaw.map(c => (c.includes('||') ? '(' + c + ')' : c));
                jsExpression = parts.join(' && ');
            }
        }

        // Also generate SAT instance in DIMACS CNF format
        const varCount = variableNames.length;
        let cnfClauses = [];
        if (hasEmptyClause) {
            cnfClauses = ['0'];
        } else {
            cnfClauses = chosenExpanded.map(pi => {
                if (pi.jsClause === '') return '0';
                const lits = [];
                for (let i = 0; i < pi.pattern.length; i++) {
                    const bit = pi.pattern[i];
                    if (bit === '-') continue;
                    const idx = i + 1;
                    lits.push(bit === '0' ? idx : -idx);
                }
                return lits.join(' ') + ' 0';
            });
        }
        const cnfCode =
            `p cnf ${varCount} ${cnfClauses.length}\n` +
            cnfClauses.join('\n');

        return {
            js: jsExpression,
            sat: cnfCode
        };
    }

    static solveDNF(variableNames, oracleFunction) {
        const minterms = [];
        const initialImplicants = [];

        const numVariables = variableNames.length;
        for (let weight = 0; weight <= numVariables; weight++) {
            for (const item of BinomialCoefficients.filterGenerator(numVariables, weight, oracleFunction)) {
                const bitPattern = item.bits;
                const numericValue = Number(item.value);
                const isMinterm = (item.oracleResponse === true);
                if (isMinterm) minterms.push(numericValue);
                initialImplicants.push({
                    bits: bitPattern,
                    minterms: new Set(isMinterm ? [numericValue] : []),
                    used: false
                });
            }
        }

        const implicantLevels = QuineMcCluskey.buildImplicantLevels(initialImplicants);

        const allPrimeBits = new Set();
        for (const lvl of implicantLevels) {
            for (const b of lvl.primeSet) allPrimeBits.add(b);
        }
        const primeImplicantsBits = Array.from(allPrimeBits).sort();

        const mintermsSorted = [...minterms].sort((a, b) => a - b);
        const mintermBinaryStrings = mintermsSorted.map(v => QuineMcCluskey.toBitString(numVariables, v));
        const coverageChart = new Map();
        for (const implicantPattern of primeImplicantsBits) {
            const patternRegex = new RegExp('^' + implicantPattern.replace(/-/g, '[01]') + '$');
            const coverageBits = mintermBinaryStrings.map(binStr => (patternRegex.test(binStr) ? '1' : '0')).join('');
            coverageChart.set(implicantPattern, coverageBits);
        }

        const essentialBits = new Set(QuineMcCluskey.getEssentialPrimeImplicants(coverageChart));

        const termFromPattern = (pattern) => {
            const jsTokens = [];
            for (let i = 0; i < pattern.length; i++) {
                const bit = pattern[i];
                if (bit === '-') continue;
                const varName = variableNames[i] || ('V' + i);
                jsTokens.push(bit === '1' ? varName : '!' + varName);
            }
            if (!jsTokens.length) return ''; // Empty term is true
            if (jsTokens.length === 1) return jsTokens[0];
            return jsTokens.join(' && ');
        };

        const primeImplicantsExpanded = primeImplicantsBits.map(pattern => {
            const coverageBits = coverageChart.get(pattern) || '';
            const covers = [];
            for (let i = 0; i < coverageBits.length; i++) {
                if (coverageBits[i] === '1') {
                    covers.push(mintermsSorted[i]);
                }
            }
            return {
                pattern,
                jsTerm: termFromPattern(pattern),
                covers,
                essential: essentialBits.has(pattern)
            };
        }).sort((a, b) => a.pattern.localeCompare(b.pattern));

        const essentialExpanded = primeImplicantsExpanded.filter(pi => pi.essential);
        const essentialSet = new Set(essentialExpanded.map(pi => pi.pattern));

        // Remove columns covered by essentials; solve remaining with Petrick's method (rows are prime implicants of F)
        const coveredByEssentials = new Set();
        for (let col = 0; col < mintermsSorted.length; col++) {
            for (const pi of essentialExpanded) {
                const bits = coverageChart.get(pi.pattern) || '';
                if (bits[col] === '1') {
                    coveredByEssentials.add(col);
                    break;
                }
            }
        }
        const toCover = [];
        for (let col = 0; col < mintermsSorted.length; col++) if (!coveredByEssentials.has(col)) toCover.push(col);
        const petrickChosen = (toCover.length ? QuineMcCluskey.petrickMinCover(coverageChart, toCover, essentialSet) : new Set());
        const chosenSet = new Set([...essentialSet, ...petrickChosen]);
        const chosenExpanded = primeImplicantsExpanded.filter(pi => chosenSet.has(pi.pattern));

        // If there are no minterms (contradiction) then DNF is false; if any chosen term is empty (all '-') then DNF is true
        const hasEmptyTerm = chosenExpanded.some(pi => pi.jsTerm === '');
        let jsExpression;
        if (hasEmptyTerm) {
            jsExpression = 'true';
        } else if (mintermsSorted.length === 0) {
            jsExpression = 'false';
        } else {
            const partsRaw = chosenExpanded.map(pi => pi.jsTerm);
            if (partsRaw.length === 1) {
                // Single term
                jsExpression = partsRaw[0];
            } else {
                // Multiple terms
                const parts = partsRaw.map(t => (t.includes('&&') ? '(' + t + ')' : t));
                jsExpression = parts.join(' || ');
            }
        }

        // Also generate SAT instance in DIMACS DNF format
        const varCount = variableNames.length;
        let dnfClauses = [];
        if (hasEmptyTerm) {
            dnfClauses = ['0'];
        } else {
            dnfClauses = chosenExpanded.map(pi => {
                if (pi.jsTerm === '') return '0';
                const lits = [];
                for (let i = 0; i < pi.pattern.length; i++) {
                    const bit = pi.pattern[i];
                    if (bit === '-') continue;
                    const idx = i + 1;
                    lits.push(bit === '1' ? idx : -idx);
                }
                return lits.join(' ') + ' 0';
            });
        }
        const dnfCode =
            `p dnf ${varCount} ${dnfClauses.length}\n` +
            dnfClauses.join('\n');

        return {
            js: jsExpression,
            sat: dnfCode
        };
    }
}
