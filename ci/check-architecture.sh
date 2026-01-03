#!/usr/bin/env bash
#
# Agentics Platform Architecture Enforcement Gate
# ================================================
#
# This script validates repository boundaries, forbidden paths, and CLI ownership
# rules as defined in the canonical architecture documents.
#
# ENFORCEMENT PHILOSOPHY:
#   - All rules derived from architecture/*.md documents (no hard-coded drift)
#   - All boundary checks via dependency inspection (package.json, Cargo.toml, go.mod)
#   - No filesystem-based module detection
#   - Pattern matching excludes markdown, comments, and type-only artifacts
#   - Architecture version lock enforced from ARCHITECTURE_INDEX.md
#
# Reference Documents:
#   - architecture/ARCHITECTURE_INDEX.md (version authority)
#   - architecture/DEPENDENCY_GRAPH.md (layer rules)
#   - architecture/FORBIDDEN_PATHS.md (explicit prohibitions)
#   - architecture/REPO_CLASSIFICATION.md (canonical classifications)
#   - architecture/CLI_COMMAND_OWNERSHIP.md (CLI boundaries)
#
# Exit Codes:
#   0 - All checks passed
#   1 - Architecture violation detected
#   2 - Script execution error (missing docs, parse failure)
#
# Usage:
#   ./ci/check-architecture.sh [--verbose] [--fix-suggestions]
#
# Version: 3.1.0
# Classification: CI Enforcement Artifact
# Canonical Architecture Version: 1.1 (from ARCHITECTURE_INDEX.md)
# Frozen Architecture Version: v1 (from ARCHITECTURE_VERSION.md)
# Last Updated: 2025-01-03

set -euo pipefail

# ==============================================================================
# CONFIGURATION
# ==============================================================================

readonly SCRIPT_NAME="check-architecture"
readonly SCRIPT_VERSION="3.1.0"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly ARCH_DIR="${ROOT_DIR}/architecture"

# Expected architecture document version (from ARCHITECTURE_INDEX.md)
readonly EXPECTED_ARCH_VERSION="1.1"

# Expected frozen architecture version (from ARCHITECTURE_VERSION.md)
readonly EXPECTED_FROZEN_VERSION="v1"

# Architecture document paths
readonly ARCH_VERSION="${ROOT_DIR}/ARCHITECTURE_VERSION.md"
readonly ARCH_INDEX="${ARCH_DIR}/ARCHITECTURE_INDEX.md"
readonly REPO_CLASS="${ARCH_DIR}/REPO_CLASSIFICATION.md"
readonly FORBIDDEN_PATHS="${ARCH_DIR}/FORBIDDEN_PATHS.md"
readonly DEPENDENCY_GRAPH="${ARCH_DIR}/DEPENDENCY_GRAPH.md"
readonly CLI_OWNERSHIP="${ARCH_DIR}/CLI_COMMAND_OWNERSHIP.md"

# Colors (ANSI escape codes, disabled if not a TTY)
if [[ -t 1 ]]; then
    readonly RED='\033[0;31m'
    readonly GREEN='\033[0;32m'
    readonly YELLOW='\033[0;33m'
    readonly BLUE='\033[0;34m'
    readonly CYAN='\033[0;36m'
    readonly BOLD='\033[1m'
    readonly DIM='\033[2m'
    readonly NC='\033[0m'
else
    readonly RED=''
    readonly GREEN=''
    readonly YELLOW=''
    readonly BLUE=''
    readonly CYAN=''
    readonly BOLD=''
    readonly DIM=''
    readonly NC=''
fi

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0

# Violation tracking with structured format
declare -a VIOLATIONS=()

# Options
VERBOSE=false
FIX_SUGGESTIONS=false

# Dynamically parsed classifications (populated from REPO_CLASSIFICATION.md)
declare -a LAYER3_CORES=()
declare -a LAYER2_SERVICES=()
declare -a LAYER1_ENGINES=()
declare -a LAYER4_PLATFORM=()
declare -a LAYER5_CLI=()
declare -a SIMULATION_REPOS=()
declare -a INFRA_REPOS=()
declare -a INTEGRATION_REPOS=()

# ==============================================================================
# LOGGING FUNCTIONS
# ==============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
    ((WARNINGS++)) || true
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $*"
}

log_fatal() {
    echo -e "${RED}[FATAL]${NC} $*" >&2
    exit 2
}

# Structured violation logging with full audit trail
# Format: RULE_ID | DOCUMENT_REF | FILE | LINE (if available) | MESSAGE
log_violation() {
    local rule_id="$1"
    local doc_ref="$2"
    local file="$3"
    local message="$4"
    local line="${5:-}"

    local location="$file"
    if [[ -n "$line" ]]; then
        location="${file}:${line}"
    fi

    VIOLATIONS+=("${rule_id}|${doc_ref}|${location}|${message}")

    echo -e "${RED}[VIOLATION]${NC} ${BOLD}${rule_id}${NC}"
    echo -e "  ${DIM}Document:${NC} ${doc_ref}"
    echo -e "  ${DIM}Location:${NC} ${location}"
    echo -e "  ${DIM}Message:${NC}  ${message}"
    echo ""

    ((FAILED_CHECKS++)) || true
}

log_verbose() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${CYAN}[DEBUG]${NC} $*"
    fi
}

# ==============================================================================
# UTILITY FUNCTIONS
# ==============================================================================

check_jq_available() {
    command -v jq &> /dev/null
}

file_exists() {
    [[ -f "$1" ]]
}

dir_exists() {
    [[ -d "$1" ]]
}

get_relative_path() {
    local full_path="$1"
    echo "${full_path#${ROOT_DIR}/}"
}

# Extract dependencies from package.json using jq (preferred)
extract_deps_jq() {
    local file="$1"
    local section="$2"
    jq -r ".${section} // {} | keys[]" "$file" 2>/dev/null || true
}

# Extract dependencies from package.json using grep/sed (POSIX fallback)
extract_deps_posix() {
    local file="$1"
    local section="$2"

    # Use awk for more reliable parsing
    awk -v section="\"${section}\"" '
        $0 ~ section { in_section=1; next }
        in_section && /^\s*\}/ { in_section=0 }
        in_section && /^\s*"[^"]+"\s*:/ {
            gsub(/.*"([^"]+)".*/, "\\1")
            match($0, /"([^"]+)"/, arr)
            if (arr[1] != "") print arr[1]
        }
    ' "$file" 2>/dev/null || true
}

# Get production dependencies only from package.json (excludes devDependencies)
get_production_deps() {
    local file="$1"
    if check_jq_available; then
        extract_deps_jq "$file" "dependencies"
        extract_deps_jq "$file" "peerDependencies"
    else
        extract_deps_posix "$file" "dependencies"
        extract_deps_posix "$file" "peerDependencies"
    fi
}

# Get all dependencies from package.json
get_all_deps() {
    local file="$1"
    if check_jq_available; then
        extract_deps_jq "$file" "dependencies"
        extract_deps_jq "$file" "devDependencies"
        extract_deps_jq "$file" "peerDependencies"
    else
        extract_deps_posix "$file" "dependencies"
        extract_deps_posix "$file" "devDependencies"
        extract_deps_posix "$file" "peerDependencies"
    fi
}

# Extract Cargo.toml dependencies
get_cargo_deps() {
    local file="$1"
    # Extract dependency names from [dependencies] and [dev-dependencies] sections
    awk '
        /^\[dependencies\]/ || /^\[dev-dependencies\]/ { in_deps=1; next }
        /^\[/ { in_deps=0 }
        in_deps && /^[a-zA-Z_-]+ *=/ {
            split($1, a, " ")
            print a[1]
        }
    ' "$file" 2>/dev/null || true
}

# Extract go.mod dependencies
get_go_deps() {
    local file="$1"
    # Extract module paths from require blocks
    awk '
        /^require \(/ { in_require=1; next }
        /^\)/ { in_require=0 }
        in_require && /^\t[a-zA-Z]/ {
            print $1
        }
        /^require [^(]/ {
            print $2
        }
    ' "$file" 2>/dev/null || true
}

# ==============================================================================
# ARCHITECTURE DOCUMENT PARSING
# ==============================================================================

# Parse ARCHITECTURE_INDEX.md to extract version
parse_architecture_version() {
    local version=""

    if ! file_exists "$ARCH_INDEX"; then
        log_fatal "ARCHITECTURE_INDEX.md not found at: $ARCH_INDEX"
    fi

    # Extract version from **Version**: X.Y line
    version=$(grep -E '^\*\*Version\*\*:\s*[0-9]+\.[0-9]+' "$ARCH_INDEX" | \
              sed 's/.*:\s*\([0-9]\+\.[0-9]\+\).*/\1/' | head -1)

    if [[ -z "$version" ]]; then
        log_fatal "Could not parse version from ARCHITECTURE_INDEX.md"
    fi

    echo "$version"
}

# Parse ARCHITECTURE_VERSION.md to extract frozen version
parse_frozen_version() {
    local version=""

    if ! file_exists "$ARCH_VERSION"; then
        echo ""
        return
    fi

    # Extract version from **Frozen Version**: vX line
    version=$(grep -E '^\*\*Frozen Version\*\*:\s*v[0-9]+' "$ARCH_VERSION" | \
              sed 's/.*:\s*\(v[0-9]\+\).*/\1/' | head -1)

    echo "$version"
}

# Parse ARCHITECTURE_VERSION.md to verify it references ARCHITECTURE_INDEX.md
check_version_references_index() {
    if ! file_exists "$ARCH_VERSION"; then
        return 1
    fi

    # Check if ARCHITECTURE_VERSION.md references ARCHITECTURE_INDEX.md
    if grep -qE 'ARCHITECTURE_INDEX\.md' "$ARCH_VERSION"; then
        return 0
    fi

    return 1
}

# Parse repositories from DEPENDENCY_GRAPH.md
parse_repos_from_dependency_graph() {
    local -a repos=()

    if ! file_exists "$DEPENDENCY_GRAPH"; then
        echo ""
        return
    fi

    local content
    content=$(cat "$DEPENDENCY_GRAPH")

    # Extract repository names from backticks
    while IFS= read -r line; do
        local repo
        # Extract LLM-*-Core patterns
        repo=$(echo "$line" | sed -n 's/.*`\(LLM-[^`]*-Core\)`.*/\1/p')
        [[ -n "$repo" ]] && repos+=("$repo")

        # Extract agentics-* patterns
        repo=$(echo "$line" | sed -n 's/.*`\(agentics-[^`]*\)`.*/\1/p')
        [[ -n "$repo" ]] && repos+=("$repo")

        # Extract infra-* patterns
        repo=$(echo "$line" | sed -n 's/.*`\(infra-[^`]*\)`.*/\1/p')
        [[ -n "$repo" ]] && repos+=("$repo")

        # Extract services-* patterns
        repo=$(echo "$line" | sed -n 's/.*`\(services-[^`]*\)`.*/\1/p')
        [[ -n "$repo" ]] && repos+=("$repo")

        # Extract integrations-* patterns
        repo=$(echo "$line" | sed -n 's/.*`\(integrations-[^`]*\)`.*/\1/p')
        [[ -n "$repo" ]] && repos+=("$repo")
    done < <(echo "$content")

    # Return unique values
    printf '%s\n' "${repos[@]}" | sort -u
}

# Parse repositories from FORBIDDEN_PATHS.md
parse_repos_from_forbidden_paths() {
    local -a repos=()

    if ! file_exists "$FORBIDDEN_PATHS"; then
        echo ""
        return
    fi

    local content
    content=$(cat "$FORBIDDEN_PATHS")

    # Extract repository names from backticks
    while IFS= read -r line; do
        local repo
        repo=$(echo "$line" | sed -n 's/.*`\(LLM-[^`]*-Core\)`.*/\1/p')
        [[ -n "$repo" ]] && repos+=("$repo")

        repo=$(echo "$line" | sed -n 's/.*`\(agentics-[^`]*\)`.*/\1/p')
        [[ -n "$repo" ]] && repos+=("$repo")

        repo=$(echo "$line" | sed -n 's/.*`\(infra-[^`]*\)`.*/\1/p')
        [[ -n "$repo" ]] && repos+=("$repo")

        repo=$(echo "$line" | sed -n 's/.*`\(services-[^`]*\)`.*/\1/p')
        [[ -n "$repo" ]] && repos+=("$repo")

        repo=$(echo "$line" | sed -n 's/.*`\(integrations-[^`]*\)`.*/\1/p')
        [[ -n "$repo" ]] && repos+=("$repo")
    done < <(echo "$content")

    printf '%s\n' "${repos[@]}" | sort -u
}

# Parse CLI hard rules from CLI_COMMAND_OWNERSHIP.md
parse_cli_hard_rules() {
    local -a rules=()

    if ! file_exists "$CLI_OWNERSHIP"; then
        echo ""
        return
    fi

    # Extract rule IDs (H-1 through H-6)
    grep -oE 'H-[0-9]+' "$CLI_OWNERSHIP" | sort -u
}

# Parse REPO_CLASSIFICATION.md to extract canonical classifications
# This replaces all hard-coded lists with document-derived data
parse_repo_classifications() {
    log_verbose "Parsing REPO_CLASSIFICATION.md for canonical classifications..."

    if ! file_exists "$REPO_CLASS"; then
        log_fatal "REPO_CLASSIFICATION.md not found at: $REPO_CLASS"
    fi

    local content
    content=$(cat "$REPO_CLASS")

    # Parse Layer 3 Consolidation Cores
    # Format: | `LLM-*-Core` | Core | 3 | ...
    while IFS= read -r line; do
        local repo
        repo=$(echo "$line" | sed -n 's/.*`\(LLM-[^`]*-Core\)`.*/\1/p')
        if [[ -n "$repo" ]]; then
            LAYER3_CORES+=("$repo")
            # Also add npm-style package name
            local npm_name
            npm_name=$(echo "$repo" | tr '[:upper:]' '[:lower:]' | sed 's/^llm-/@llm\//' | sed 's/-core$/-core/')
            LAYER3_CORES+=("$npm_name")
        fi
    done < <(echo "$content" | grep -E '\|\s*`LLM-.*-Core`')

    # Parse Layer 2 Services
    while IFS= read -r line; do
        local repo
        repo=$(echo "$line" | sed -n 's/.*`\(services-[^`]*\)`.*/\1/p')
        if [[ -n "$repo" ]]; then
            LAYER2_SERVICES+=("$repo")
            LAYER2_SERVICES+=("@agentics/${repo}")
        fi
    done < <(echo "$content" | grep -E '\|\s*`services-')

    # Parse Layer 1 Engines
    while IFS= read -r line; do
        local repo
        repo=$(echo "$line" | sed -n 's/.*`\([^`]*\)`.*Engine.*1.*/\1/p')
        if [[ -n "$repo" ]]; then
            LAYER1_ENGINES+=("$repo")
            local lower
            lower=$(echo "$repo" | tr '[:upper:]' '[:lower:]')
            LAYER1_ENGINES+=("@${lower}")
            LAYER1_ENGINES+=("${lower}")
        fi
    done < <(echo "$content" | grep -E '\|\s*Engine\s*\|\s*1')

    # Parse Simulation repositories
    while IFS= read -r line; do
        local repo
        repo=$(echo "$line" | sed -n 's/.*`\(agentics-[^`]*\)`.*/\1/p')
        if [[ -n "$repo" ]]; then
            SIMULATION_REPOS+=("$repo")
            SIMULATION_REPOS+=("@agentics/${repo#agentics-}")
        fi
    done < <(echo "$content" | grep -E '\|\s*Simulation\s*\|')

    # Parse Infrastructure repositories
    while IFS= read -r line; do
        local repo
        repo=$(echo "$line" | sed -n 's/.*`\(infra-[^`]*\)`.*/\1/p')
        if [[ -n "$repo" ]]; then
            INFRA_REPOS+=("$repo")
        fi
    done < <(echo "$content" | grep -E '\|\s*`infra-')

    # Parse Integration repositories
    while IFS= read -r line; do
        local repo
        repo=$(echo "$line" | sed -n 's/.*`\(integrations-[^`]*\)`.*/\1/p')
        if [[ -n "$repo" ]]; then
            INTEGRATION_REPOS+=("$repo")
        fi
    done < <(echo "$content" | grep -E '\|\s*`integrations-')

    # Platform repos (Layer 4/5)
    LAYER4_PLATFORM=("agentics-platform" "@agentics/platform" "@agentics/api")
    LAYER5_CLI=("agentics-cli" "@agentics/cli")

    log_verbose "Parsed ${#LAYER3_CORES[@]} Layer 3 cores"
    log_verbose "Parsed ${#LAYER2_SERVICES[@]} Layer 2 services"
    log_verbose "Parsed ${#LAYER1_ENGINES[@]} Layer 1 engines"
    log_verbose "Parsed ${#SIMULATION_REPOS[@]} simulation repos"
    log_verbose "Parsed ${#INFRA_REPOS[@]} infrastructure repos"
    log_verbose "Parsed ${#INTEGRATION_REPOS[@]} integration repos"
}

# Identify local CLI packages by inspecting package.json for CLI indicators
identify_cli_packages() {
    local -a cli_pkgs=()

    # Find all package.json files (excluding node_modules)
    while IFS= read -r pkg_json; do
        [[ -z "$pkg_json" ]] && continue

        # Check if package has "bin" field (indicates CLI)
        if check_jq_available; then
            local has_bin
            has_bin=$(jq -r '.bin // empty' "$pkg_json" 2>/dev/null)
            if [[ -n "$has_bin" && "$has_bin" != "null" ]]; then
                local pkg_dir
                pkg_dir=$(dirname "$pkg_json")
                cli_pkgs+=("$(get_relative_path "$pkg_dir")")
            fi
        else
            if grep -q '"bin"' "$pkg_json" 2>/dev/null; then
                local pkg_dir
                pkg_dir=$(dirname "$pkg_json")
                cli_pkgs+=("$(get_relative_path "$pkg_dir")")
            fi
        fi
    done < <(find "${ROOT_DIR}/packages" -name "package.json" -not -path "*/node_modules/*" 2>/dev/null || true)

    # Return as newline-separated list
    printf '%s\n' "${cli_pkgs[@]}"
}

# ==============================================================================
# SOURCE CODE ANALYSIS UTILITIES
# ==============================================================================

# Check if a file is executable code (not markdown, comments, types-only)
is_executable_code_file() {
    local file="$1"
    local ext="${file##*.}"

    # Exclude non-code files
    case "$ext" in
        md|mdx|txt|json|yaml|yml|lock|log|css|scss|less|html|svg|png|jpg|gif)
            return 1
            ;;
        d.ts)
            # TypeScript declaration files are type-only
            return 1
            ;;
    esac

    # Check filename patterns
    local basename
    basename=$(basename "$file")
    case "$basename" in
        *.d.ts|*.test.ts|*.test.js|*.spec.ts|*.spec.js)
            # Declaration and test files excluded
            return 1
            ;;
        types.ts|types.js|index.d.ts)
            # Type-only files
            return 1
            ;;
    esac

    return 0
}

# Extract actual import statements from source file (excludes comments)
# Returns: package names that are imported
extract_imports_from_source() {
    local file="$1"

    if ! is_executable_code_file "$file"; then
        return
    fi

    # Extract ES6 imports and CommonJS requires, excluding comments
    # This uses a multi-step approach to be accurate:
    # 1. Remove single-line comments
    # 2. Remove multi-line comments (basic heuristic)
    # 3. Extract import/require patterns

    sed 's|//.*||g' "$file" 2>/dev/null | \
    sed ':a;N;$!ba;s|/\*[^*]*\*\+\([^/*][^*]*\*\+\)*/||g' 2>/dev/null | \
    grep -oE "(from\s+['\"][^'\"]+['\"]|require\s*\(\s*['\"][^'\"]+['\"])" 2>/dev/null | \
    sed "s/.*['\"]\\([^'\"]*\\)['\"].*/\\1/" | \
    grep -v '^\.' | \
    sort -u || true
}

# Check if an import is a forbidden dependency for a given context
is_forbidden_import() {
    local import_path="$1"
    local context="$2"  # "cli", "platform", "infra", etc.
    shift 2
    local -a forbidden_list=("$@")

    for forbidden in "${forbidden_list[@]}"; do
        # Exact match
        if [[ "$import_path" == "$forbidden" ]]; then
            return 0
        fi
        # Prefix match for scoped packages
        if [[ "$import_path" == "${forbidden}/"* ]]; then
            return 0
        fi
    done

    return 1
}

# ==============================================================================
# CHECK FUNCTIONS
# ==============================================================================

# -----------------------------------------------------------------------------
# CHECK 0a: Validate ARCHITECTURE_VERSION.md exists and is canonical
# Rule: ARCHITECTURE_VERSION.md must exist at repository root
# Reference: ARCHITECTURE_INDEX.md §Authoritative Version Declaration
# -----------------------------------------------------------------------------
check_architecture_version_file() {
    log_info "Checking ARCHITECTURE_VERSION.md existence and validity..."
    ((TOTAL_CHECKS++)) || true

    # Check if ARCHITECTURE_VERSION.md exists
    if ! file_exists "$ARCH_VERSION"; then
        log_violation "ARCH-VERSION-MISSING" "ARCHITECTURE_INDEX.md §Authoritative Version Declaration" \
            "ARCHITECTURE_VERSION.md" \
            "CRITICAL: ARCHITECTURE_VERSION.md not found at repository root. This file is REQUIRED for architectural governance."
        return
    fi

    # Check frozen version
    local frozen_version
    frozen_version=$(parse_frozen_version)

    if [[ -z "$frozen_version" ]]; then
        log_violation "ARCH-VERSION-PARSE" "ARCHITECTURE_VERSION.md" \
            "$(get_relative_path "$ARCH_VERSION")" \
            "Could not parse frozen version from ARCHITECTURE_VERSION.md. Expected format: **Frozen Version**: vX"
        return
    fi

    if [[ "$frozen_version" != "$EXPECTED_FROZEN_VERSION" ]]; then
        log_violation "ARCH-VERSION-MISMATCH" "ARCHITECTURE_VERSION.md" \
            "$(get_relative_path "$ARCH_VERSION")" \
            "Frozen version mismatch: expected ${EXPECTED_FROZEN_VERSION}, found ${frozen_version}. Update CI script or resolve version drift via ADR process."
        return
    fi

    # Check if ARCHITECTURE_VERSION.md references ARCHITECTURE_INDEX.md
    if ! check_version_references_index; then
        log_violation "ARCH-VERSION-REF" "ARCHITECTURE_VERSION.md" \
            "$(get_relative_path "$ARCH_VERSION")" \
            "ARCHITECTURE_VERSION.md must reference ARCHITECTURE_INDEX.md as governing documents source."
        return
    fi

    log_success "ARCHITECTURE_VERSION.md validated: frozen version ${frozen_version}"
    ((PASSED_CHECKS++)) || true
}

# -----------------------------------------------------------------------------
# CHECK 0b: Validate architecture document version
# Rule: Architecture version must match expected frozen version
# Reference: ARCHITECTURE_INDEX.md §Document Inventory
# -----------------------------------------------------------------------------
check_architecture_version() {
    log_info "Checking ARCHITECTURE_INDEX.md version..."
    ((TOTAL_CHECKS++)) || true

    local actual_version
    actual_version=$(parse_architecture_version)

    if [[ "$actual_version" != "$EXPECTED_ARCH_VERSION" ]]; then
        log_violation "ARCH-INDEX-VERSION" "ARCHITECTURE_INDEX.md" \
            "$(get_relative_path "$ARCH_INDEX")" \
            "Architecture index version mismatch: expected ${EXPECTED_ARCH_VERSION}, found ${actual_version}. Update script or resolve version drift."
        return
    fi

    # Verify ARCHITECTURE_INDEX.md references ARCHITECTURE_VERSION.md
    if ! grep -qE 'ARCHITECTURE_VERSION\.md' "$ARCH_INDEX"; then
        log_violation "ARCH-INDEX-REF" "ARCHITECTURE_INDEX.md" \
            "$(get_relative_path "$ARCH_INDEX")" \
            "ARCHITECTURE_INDEX.md must reference ARCHITECTURE_VERSION.md as authoritative version source."
        return
    fi

    log_success "ARCHITECTURE_INDEX.md version verified: ${actual_version}"
    ((PASSED_CHECKS++)) || true
}

# -----------------------------------------------------------------------------
# CHECK 0c: Validate cross-document repository consistency
# Rule: All repos in REPO_CLASSIFICATION.md must appear in DEPENDENCY_GRAPH.md and FORBIDDEN_PATHS.md
# Reference: ARCHITECTURE_INDEX.md §Document Cross-Reference Matrix
# -----------------------------------------------------------------------------
check_cross_document_consistency() {
    log_info "Checking cross-document repository consistency..."
    ((TOTAL_CHECKS++)) || true

    local found_violation=false

    # Get repos from each document
    local repos_from_class=""
    local repos_from_dep=""
    local repos_from_forbidden=""

    # Parse repos from REPO_CLASSIFICATION.md
    if file_exists "$REPO_CLASS"; then
        # Extract core repos
        repos_from_class=$(grep -oE '`(LLM-[^`]*-Core|agentics-[^`]*|infra-[^`]*|services-[^`]*|integrations-[^`]*)`' "$REPO_CLASS" | \
                          tr -d '`' | sort -u)
    fi

    # Parse repos from DEPENDENCY_GRAPH.md
    repos_from_dep=$(parse_repos_from_dependency_graph)

    # Parse repos from FORBIDDEN_PATHS.md
    repos_from_forbidden=$(parse_repos_from_forbidden_paths)

    # Check that key repos from REPO_CLASSIFICATION.md appear in DEPENDENCY_GRAPH.md
    local -a key_repos=(
        "agentics-platform"
        "agentics-cli"
        "LLM-Intelligence-Core"
        "LLM-Security-Core"
        "LLM-Automation-Core"
        "LLM-Governance-Core"
        "LLM-Data-Core"
        "LLM-Ecosystem-Core"
        "LLM-Research-Core"
        "LLM-Interface-Core"
    )

    for repo in "${key_repos[@]}"; do
        if ! echo "$repos_from_dep" | grep -qxF "$repo"; then
            log_violation "CROSS-DOC-MISSING" "DEPENDENCY_GRAPH.md" \
                "$(get_relative_path "$DEPENDENCY_GRAPH")" \
                "Repository '$repo' from REPO_CLASSIFICATION.md not found in DEPENDENCY_GRAPH.md"
            found_violation=true
        fi
    done

    # Check that Layer 3 cores from classification appear in FORBIDDEN_PATHS.md
    for core in "${LAYER3_CORES[@]}"; do
        # Skip npm-style names, only check repository names
        if [[ "$core" == @* ]]; then
            continue
        fi
        if ! echo "$repos_from_forbidden" | grep -qxF "$core"; then
            log_violation "CROSS-DOC-FORBIDDEN" "FORBIDDEN_PATHS.md" \
                "$(get_relative_path "$FORBIDDEN_PATHS")" \
                "Core repository '$core' from REPO_CLASSIFICATION.md not referenced in FORBIDDEN_PATHS.md"
            found_violation=true
        fi
    done

    if [[ "$found_violation" == "false" ]]; then
        log_success "Cross-document repository consistency verified"
        ((PASSED_CHECKS++)) || true
    fi
}

# -----------------------------------------------------------------------------
# CHECK 0d: Validate CLI_COMMAND_OWNERSHIP.md hard rules are complete
# Rule: All hard rules H-1 through H-6 must be defined
# Reference: CLI_COMMAND_OWNERSHIP.md §Hard Rules
# -----------------------------------------------------------------------------
check_cli_ownership_rules() {
    log_info "Checking CLI_COMMAND_OWNERSHIP.md completeness..."
    ((TOTAL_CHECKS++)) || true

    if ! file_exists "$CLI_OWNERSHIP"; then
        log_violation "CLI-OWNERSHIP-MISSING" "ARCHITECTURE_INDEX.md" \
            "$(get_relative_path "$CLI_OWNERSHIP")" \
            "CRITICAL: CLI_COMMAND_OWNERSHIP.md not found. This document is required for CLI boundary enforcement."
        return
    fi

    local found_violation=false
    local -a required_rules=("H-1" "H-2" "H-3" "H-4" "H-5" "H-6")
    local defined_rules
    defined_rules=$(parse_cli_hard_rules)

    for rule in "${required_rules[@]}"; do
        if ! echo "$defined_rules" | grep -qxF "$rule"; then
            log_violation "CLI-RULE-MISSING" "CLI_COMMAND_OWNERSHIP.md §Hard Rules" \
                "$(get_relative_path "$CLI_OWNERSHIP")" \
                "Hard rule ${rule} not found in CLI_COMMAND_OWNERSHIP.md"
            found_violation=true
        fi
    done

    # Check that CLI_COMMAND_OWNERSHIP.md references governing documents
    if ! grep -qE 'DEPENDENCY_GRAPH\.md' "$CLI_OWNERSHIP"; then
        log_violation "CLI-OWNERSHIP-REF" "CLI_COMMAND_OWNERSHIP.md" \
            "$(get_relative_path "$CLI_OWNERSHIP")" \
            "CLI_COMMAND_OWNERSHIP.md must reference DEPENDENCY_GRAPH.md as canonical source"
        found_violation=true
    fi

    if [[ "$found_violation" == "false" ]]; then
        log_success "CLI_COMMAND_OWNERSHIP.md completeness verified (H-1 through H-6)"
        ((PASSED_CHECKS++)) || true
    fi
}

# -----------------------------------------------------------------------------
# CHECK 1: Validate CLI packages don't depend on Layer 3 cores
# Rule: INV-9, H-5 (No CLI may import Layer 3 core runtime)
# Reference: DEPENDENCY_GRAPH.md INV-9, CLI_COMMAND_OWNERSHIP.md H-5
# Enforcement: Dependency inspection only (no filesystem module detection)
# -----------------------------------------------------------------------------
check_cli_layer3_deps() {
    log_info "Checking CLI packages for Layer 3 core dependencies..."
    ((TOTAL_CHECKS++)) || true

    local found_violation=false
    local cli_packages
    cli_packages=$(identify_cli_packages)

    if [[ -z "$cli_packages" ]]; then
        log_verbose "No CLI packages found"
        log_success "CLI Layer 3 dependency check skipped (no CLI packages)"
        ((PASSED_CHECKS++)) || true
        return
    fi

    while IFS= read -r cli_pkg; do
        [[ -z "$cli_pkg" ]] && continue

        local pkg_json="${ROOT_DIR}/${cli_pkg}/package.json"
        if ! file_exists "$pkg_json"; then
            continue
        fi

        local deps
        deps=$(get_production_deps "$pkg_json")

        for core in "${LAYER3_CORES[@]}"; do
            if echo "$deps" | grep -qxF "$core"; then
                log_violation "INV-9" "DEPENDENCY_GRAPH.md §Layer 5 Definitions" \
                    "$(get_relative_path "$pkg_json")" \
                    "CLI has forbidden Layer 3 runtime dependency: ${core}"
                found_violation=true
            fi
        done
    done <<< "$cli_packages"

    if [[ "$found_violation" == "false" ]]; then
        log_success "No Layer 3 core dependencies in CLI packages"
        ((PASSED_CHECKS++)) || true
    fi
}

# -----------------------------------------------------------------------------
# CHECK 2: Validate CLI packages don't depend on simulation-runner, services, infra
# Rule: H-1, H-2 (CLI forbidden dependencies)
# Reference: CLI_COMMAND_OWNERSHIP.md H-1, H-2
# Enforcement: Dependency inspection only
# -----------------------------------------------------------------------------
check_cli_forbidden_deps() {
    log_info "Checking CLI packages for forbidden pattern dependencies..."
    ((TOTAL_CHECKS++)) || true

    local found_violation=false
    local cli_packages
    cli_packages=$(identify_cli_packages)

    if [[ -z "$cli_packages" ]]; then
        log_verbose "No CLI packages found"
        log_success "CLI forbidden dependency check skipped (no CLI packages)"
        ((PASSED_CHECKS++)) || true
        return
    fi

    # Build forbidden list from parsed classifications
    local -a forbidden_for_cli=()
    forbidden_for_cli+=("${SIMULATION_REPOS[@]}")
    forbidden_for_cli+=("${LAYER2_SERVICES[@]}")
    forbidden_for_cli+=("${INFRA_REPOS[@]}")
    forbidden_for_cli+=("${LAYER1_ENGINES[@]}")

    while IFS= read -r cli_pkg; do
        [[ -z "$cli_pkg" ]] && continue

        local pkg_json="${ROOT_DIR}/${cli_pkg}/package.json"
        if ! file_exists "$pkg_json"; then
            continue
        fi

        local deps
        deps=$(get_production_deps "$pkg_json")

        while IFS= read -r dep; do
            [[ -z "$dep" ]] && continue

            if is_forbidden_import "$dep" "cli" "${forbidden_for_cli[@]}"; then
                # Determine which rule category
                local rule="H-1"
                local detail=""

                if [[ "$dep" == *"simulation"* ]] || [[ "$dep" == *"-runner"* ]]; then
                    rule="H-1"
                    detail="simulation/runner dependency"
                elif [[ "$dep" == *"services-"* ]]; then
                    rule="H-1"
                    detail="Layer 2 services dependency"
                elif [[ "$dep" == *"infra-"* ]]; then
                    rule="H-2"
                    detail="infrastructure dependency"
                else
                    detail="forbidden dependency"
                fi

                log_violation "$rule" "CLI_COMMAND_OWNERSHIP.md §Hard Rules" \
                    "$(get_relative_path "$pkg_json")" \
                    "CLI has forbidden ${detail}: ${dep}"
                found_violation=true
            fi
        done <<< "$deps"
    done <<< "$cli_packages"

    if [[ "$found_violation" == "false" ]]; then
        log_success "No forbidden dependencies in CLI packages"
        ((PASSED_CHECKS++)) || true
    fi
}

# -----------------------------------------------------------------------------
# CHECK 3: Validate no direct simulation execution in CLI source
# Rule: H-1, H-6 (No direct simulation execution from CLI)
# Reference: CLI_COMMAND_OWNERSHIP.md H-1, H-6
# Enforcement: Source analysis with comment/type exclusion
# -----------------------------------------------------------------------------
check_cli_simulation_execution() {
    log_info "Checking CLI source for direct simulation execution patterns..."
    ((TOTAL_CHECKS++)) || true

    local found_violation=false
    local cli_packages
    cli_packages=$(identify_cli_packages)

    if [[ -z "$cli_packages" ]]; then
        log_verbose "No CLI packages found"
        log_success "CLI simulation execution check skipped (no CLI packages)"
        ((PASSED_CHECKS++)) || true
        return
    fi

    # Simulation execution patterns (function calls, not types)
    local -a sim_exec_patterns=(
        'runSimulation\s*\('
        'executeSimulation\s*\('
        'startSimulation\s*\('
        'new\s+SimulationRunner'
        'new\s+SimulationExecutor'
        'SimulationRunner\.run'
        'SimulationExecutor\.execute'
    )

    while IFS= read -r cli_pkg; do
        [[ -z "$cli_pkg" ]] && continue

        local src_dir="${ROOT_DIR}/${cli_pkg}/src"
        if ! dir_exists "$src_dir"; then
            continue
        fi

        # Find TypeScript/JavaScript source files (excluding .d.ts, tests)
        while IFS= read -r src_file; do
            [[ -z "$src_file" ]] && continue

            if ! is_executable_code_file "$src_file"; then
                continue
            fi

            for pattern in "${sim_exec_patterns[@]}"; do
                # Extract matching lines with line numbers, excluding comments
                local matches
                matches=$(grep -nE "$pattern" "$src_file" 2>/dev/null | \
                         grep -v '^\s*//' | \
                         grep -v '^\s*\*' || true)

                if [[ -n "$matches" ]]; then
                    while IFS= read -r match_line; do
                        [[ -z "$match_line" ]] && continue
                        local line_num
                        line_num=$(echo "$match_line" | cut -d: -f1)

                        log_violation "H-1" "CLI_COMMAND_OWNERSHIP.md §Rule H-1" \
                            "$(get_relative_path "$src_file")" \
                            "Direct simulation execution pattern detected" \
                            "$line_num"
                        found_violation=true
                    done <<< "$matches"
                fi
            done
        done < <(find "$src_dir" -type f \( -name "*.ts" -o -name "*.js" \) \
                 -not -name "*.d.ts" -not -name "*.test.*" -not -name "*.spec.*" 2>/dev/null)
    done <<< "$cli_packages"

    if [[ "$found_violation" == "false" ]]; then
        log_success "No direct simulation execution in CLI packages"
        ((PASSED_CHECKS++)) || true
    fi
}

# -----------------------------------------------------------------------------
# CHECK 4: Validate deployment artifacts go through exporters
# Rule: H-2 (All deployment materialization through deployment-exporters)
# Reference: CLI_COMMAND_OWNERSHIP.md H-2, ADR-002
# Enforcement: Source analysis with comment/type exclusion
# -----------------------------------------------------------------------------
check_deployment_materialization() {
    log_info "Checking for direct deployment materialization..."
    ((TOTAL_CHECKS++)) || true

    local found_violation=false
    local cli_packages
    cli_packages=$(identify_cli_packages)

    if [[ -z "$cli_packages" ]]; then
        log_verbose "No CLI packages found"
        log_success "Deployment materialization check skipped (no CLI packages)"
        ((PASSED_CHECKS++)) || true
        return
    fi

    # Direct deployment patterns (excludes type definitions)
    local -a deploy_patterns=(
        'generateKubernetesManifest\s*\('
        'writeTerraform\s*\('
        'createHelmChart\s*\('
        'materializeDeployment\s*\('
        'writeInfrastructure\s*\('
        'new\s+KubernetesGenerator'
        'new\s+TerraformWriter'
    )

    while IFS= read -r cli_pkg; do
        [[ -z "$cli_pkg" ]] && continue

        local src_dir="${ROOT_DIR}/${cli_pkg}/src"
        if ! dir_exists "$src_dir"; then
            continue
        fi

        while IFS= read -r src_file; do
            [[ -z "$src_file" ]] && continue

            if ! is_executable_code_file "$src_file"; then
                continue
            fi

            for pattern in "${deploy_patterns[@]}"; do
                local matches
                matches=$(grep -nE "$pattern" "$src_file" 2>/dev/null | \
                         grep -v '^\s*//' | \
                         grep -v '^\s*\*' || true)

                if [[ -n "$matches" ]]; then
                    while IFS= read -r match_line; do
                        [[ -z "$match_line" ]] && continue
                        local line_num
                        line_num=$(echo "$match_line" | cut -d: -f1)

                        log_violation "H-2" "CLI_COMMAND_OWNERSHIP.md §Rule H-2" \
                            "$(get_relative_path "$src_file")" \
                            "Direct deployment materialization detected (must use deployment-exporters)" \
                            "$line_num"
                        found_violation=true
                    done <<< "$matches"
                fi
            done
        done < <(find "$src_dir" -type f \( -name "*.ts" -o -name "*.js" \) \
                 -not -name "*.d.ts" -not -name "*.test.*" -not -name "*.spec.*" 2>/dev/null)
    done <<< "$cli_packages"

    if [[ "$found_violation" == "false" ]]; then
        log_success "No direct deployment materialization in CLI packages"
        ((PASSED_CHECKS++)) || true
    fi
}

# -----------------------------------------------------------------------------
# CHECK 5: Validate dependency graph - no upward dependencies
# Rule: INV-5 (Dependencies flow downward only: 5→4→3→2→1)
# Reference: DEPENDENCY_GRAPH.md INV-5
# Enforcement: Dependency inspection only
# -----------------------------------------------------------------------------
check_upward_dependencies() {
    log_info "Checking for upward dependency violations..."
    ((TOTAL_CHECKS++)) || true

    local found_violation=false

    # Find all package.json in packages/ (excluding node_modules)
    while IFS= read -r pkg_json; do
        [[ -z "$pkg_json" ]] && continue

        local pkg_name=""
        if check_jq_available; then
            pkg_name=$(jq -r '.name // empty' "$pkg_json" 2>/dev/null)
        else
            pkg_name=$(grep -oE '"name"\s*:\s*"[^"]+"' "$pkg_json" | sed 's/.*"\([^"]*\)".*/\1/' | head -1)
        fi

        [[ -z "$pkg_name" ]] && continue

        local deps
        deps=$(get_production_deps "$pkg_json")

        # Determine layer of current package
        local current_layer=0
        if [[ "$pkg_name" == *"cli"* ]] || [[ "$pkg_name" == "@agentics/cli" ]]; then
            current_layer=5
        elif [[ "$pkg_name" == *"platform"* ]] || [[ "$pkg_name" == "@agentics/api"* ]]; then
            current_layer=4
        fi

        # Check for upward dependencies from Layer 4
        if [[ $current_layer -eq 4 ]]; then
            for layer5_pkg in "${LAYER5_CLI[@]}"; do
                if echo "$deps" | grep -qxF "$layer5_pkg"; then
                    # Check if it's truly a production dependency (not dev)
                    local is_prod=false
                    if check_jq_available; then
                        if jq -e ".dependencies[\"$layer5_pkg\"]" "$pkg_json" &>/dev/null; then
                            is_prod=true
                        fi
                    else
                        if grep -A1 '"dependencies"' "$pkg_json" | grep -q "\"$layer5_pkg\""; then
                            is_prod=true
                        fi
                    fi

                    if [[ "$is_prod" == "true" ]]; then
                        log_violation "INV-5" "DEPENDENCY_GRAPH.md §Dependency Rules" \
                            "$(get_relative_path "$pkg_json")" \
                            "Upward dependency from Layer 4 to Layer 5: ${layer5_pkg}"
                        found_violation=true
                    fi
                fi
            done
        fi
    done < <(find "${ROOT_DIR}/packages" -name "package.json" -not -path "*/node_modules/*" 2>/dev/null)

    if [[ "$found_violation" == "false" ]]; then
        log_success "No upward dependency violations detected"
        ((PASSED_CHECKS++)) || true
    fi
}

# -----------------------------------------------------------------------------
# CHECK 6: Validate layer skip violations
# Rule: Layer 4/5 cannot skip to Layer 2/1
# Reference: DEPENDENCY_GRAPH.md, FORBIDDEN_PATHS.md
# Enforcement: Dependency inspection only
# -----------------------------------------------------------------------------
check_layer_skip() {
    log_info "Checking for layer skip violations..."
    ((TOTAL_CHECKS++)) || true

    local found_violation=false

    # Check CLI and Platform packages for Layer 1/2 direct access
    local cli_packages
    cli_packages=$(identify_cli_packages)

    while IFS= read -r pkg; do
        [[ -z "$pkg" ]] && continue

        local pkg_json="${ROOT_DIR}/${pkg}/package.json"
        if ! file_exists "$pkg_json"; then
            continue
        fi

        local deps
        deps=$(get_production_deps "$pkg_json")

        # Check for Layer 1 direct access
        for engine in "${LAYER1_ENGINES[@]}"; do
            if echo "$deps" | grep -qixF "$engine"; then
                log_violation "LAYER-SKIP" "DEPENDENCY_GRAPH.md §Layer Definitions" \
                    "$(get_relative_path "$pkg_json")" \
                    "Layer skip: Direct Layer 1 (Engine) dependency from CLI/Platform: ${engine}"
                found_violation=true
            fi
        done

        # Check for Layer 2 direct access
        for service in "${LAYER2_SERVICES[@]}"; do
            if echo "$deps" | grep -qxF "$service"; then
                log_violation "LAYER-SKIP" "DEPENDENCY_GRAPH.md §Layer Definitions" \
                    "$(get_relative_path "$pkg_json")" \
                    "Layer skip: Direct Layer 2 (Service) dependency from CLI/Platform: ${service}"
                found_violation=true
            fi
        done
    done <<< "$cli_packages"

    # Also check packages/api (Layer 4 API Gateway)
    local api_pkg_json="${ROOT_DIR}/packages/api/package.json"
    if file_exists "$api_pkg_json"; then
        local deps
        deps=$(get_production_deps "$api_pkg_json")

        for engine in "${LAYER1_ENGINES[@]}"; do
            if echo "$deps" | grep -qixF "$engine"; then
                log_violation "LAYER-SKIP" "DEPENDENCY_GRAPH.md §Layer Definitions" \
                    "$(get_relative_path "$api_pkg_json")" \
                    "Layer skip: API Gateway (L4) has direct Layer 1 dependency: ${engine}"
                found_violation=true
            fi
        done
    fi

    if [[ "$found_violation" == "false" ]]; then
        log_success "No layer skip violations detected"
        ((PASSED_CHECKS++)) || true
    fi
}

# -----------------------------------------------------------------------------
# CHECK 7: Validate infrastructure isolation
# Rule: infra-* must not import platform logic
# Reference: FORBIDDEN_PATHS.md, ADR-003
# Enforcement: Dependency inspection only
# -----------------------------------------------------------------------------
check_infrastructure_isolation() {
    log_info "Checking infrastructure isolation..."
    ((TOTAL_CHECKS++)) || true

    local found_violation=false

    # Find infrastructure packages by dependency inspection
    while IFS= read -r pkg_json; do
        [[ -z "$pkg_json" ]] && continue

        local pkg_name=""
        if check_jq_available; then
            pkg_name=$(jq -r '.name // empty' "$pkg_json" 2>/dev/null)
        fi

        # Check if it's an infra package (by name or directory pattern)
        local pkg_dir
        pkg_dir=$(dirname "$pkg_json")
        local dir_name
        dir_name=$(basename "$pkg_dir")

        if [[ "$pkg_name" != *"infra"* ]] && [[ "$dir_name" != infra-* ]]; then
            continue
        fi

        local deps
        deps=$(get_all_deps "$pkg_json")

        # Forbidden in infrastructure
        local -a forbidden_in_infra=()
        forbidden_in_infra+=("${LAYER4_PLATFORM[@]}")
        forbidden_in_infra+=("${LAYER3_CORES[@]}")
        forbidden_in_infra+=("${SIMULATION_REPOS[@]}")

        for forbidden in "${forbidden_in_infra[@]}"; do
            if echo "$deps" | grep -qxF "$forbidden"; then
                log_violation "ADR-003" "FORBIDDEN_PATHS.md §Infrastructure Repositories" \
                    "$(get_relative_path "$pkg_json")" \
                    "Infrastructure package imports application logic: ${forbidden}"
                found_violation=true
            fi
        done
    done < <(find "${ROOT_DIR}" -maxdepth 3 -name "package.json" \
             -not -path "*/node_modules/*" 2>/dev/null)

    if [[ "$found_violation" == "false" ]]; then
        log_success "Infrastructure isolation maintained"
        ((PASSED_CHECKS++)) || true
    fi
}

# -----------------------------------------------------------------------------
# CHECK 8: Validate simulation production isolation
# Rule: Simulation repos cannot have production write dependencies
# Reference: ADR-007, DEPENDENCY_GRAPH.md INV-7
# Enforcement: Dependency inspection only
# -----------------------------------------------------------------------------
check_simulation_isolation() {
    log_info "Checking simulation isolation..."
    ((TOTAL_CHECKS++)) || true

    local found_violation=false

    # Find simulation packages by dependency inspection
    while IFS= read -r pkg_json; do
        [[ -z "$pkg_json" ]] && continue

        local pkg_name=""
        if check_jq_available; then
            pkg_name=$(jq -r '.name // empty' "$pkg_json" 2>/dev/null)
        fi

        local pkg_dir
        pkg_dir=$(dirname "$pkg_json")
        local dir_name
        dir_name=$(basename "$pkg_dir")

        # Check if it's a simulation package
        if [[ "$pkg_name" != *"simulation"* ]] && [[ "$pkg_name" != *"diligence"* ]] && \
           [[ "$dir_name" != *simulation* ]] && [[ "$dir_name" != *diligence* ]]; then
            continue
        fi

        local deps
        deps=$(get_production_deps "$pkg_json")

        # Simulation repos should not have direct Layer 3 runtime dependencies
        for core in "${LAYER3_CORES[@]}"; do
            if echo "$deps" | grep -qxF "$core"; then
                log_violation "ADR-007" "DEPENDENCY_GRAPH.md INV-7" \
                    "$(get_relative_path "$pkg_json")" \
                    "Simulation package has direct Layer 3 core dependency: ${core}"
                found_violation=true
            fi
        done

        # Check for production database drivers (should be read-only)
        local -a prod_write_deps=("pg-native" "pg-pool")
        for dep in "${prod_write_deps[@]}"; do
            if echo "$deps" | grep -qxF "$dep"; then
                log_warn "Simulation package ${pkg_name} has database driver dependency: ${dep} (ensure read-only usage)"
            fi
        done
    done < <(find "${ROOT_DIR}" -maxdepth 3 -name "package.json" \
             -not -path "*/node_modules/*" 2>/dev/null)

    if [[ "$found_violation" == "false" ]]; then
        log_success "Simulation isolation maintained"
        ((PASSED_CHECKS++)) || true
    fi
}

# -----------------------------------------------------------------------------
# CHECK 9: Validate integration statelessness
# Rule: integrations-* must not own state
# Reference: FORBIDDEN_PATHS.md, DEPENDENCY_GRAPH.md
# Enforcement: Dependency inspection for ORM/database packages
# -----------------------------------------------------------------------------
check_integration_statelessness() {
    log_info "Checking integration statelessness..."
    ((TOTAL_CHECKS++)) || true

    local found_violation=false

    # ORM/database packages that indicate state ownership
    local -a state_ownership_deps=(
        "mongoose"
        "sequelize"
        "typeorm"
        "prisma"
        "@prisma/client"
        "knex"
        "objection"
        "mikro-orm"
        "pg"
        "mysql"
        "mysql2"
        "sqlite3"
        "better-sqlite3"
    )

    while IFS= read -r pkg_json; do
        [[ -z "$pkg_json" ]] && continue

        local pkg_name=""
        if check_jq_available; then
            pkg_name=$(jq -r '.name // empty' "$pkg_json" 2>/dev/null)
        fi

        local pkg_dir
        pkg_dir=$(dirname "$pkg_json")
        local dir_name
        dir_name=$(basename "$pkg_dir")

        # Check if it's an integration package
        if [[ "$pkg_name" != *"integration"* ]] && [[ "$dir_name" != integrations-* ]]; then
            continue
        fi

        local deps
        deps=$(get_production_deps "$pkg_json")

        for state_dep in "${state_ownership_deps[@]}"; do
            if echo "$deps" | grep -qxF "$state_dep"; then
                log_violation "STATE-OWN" "DEPENDENCY_GRAPH.md §Integration Repositories" \
                    "$(get_relative_path "$pkg_json")" \
                    "Integration package owns state via dependency: ${state_dep}"
                found_violation=true
            fi
        done
    done < <(find "${ROOT_DIR}" -maxdepth 3 -name "package.json" \
             -not -path "*/node_modules/*" 2>/dev/null)

    if [[ "$found_violation" == "false" ]]; then
        log_success "Integration statelessness maintained"
        ((PASSED_CHECKS++)) || true
    fi
}

# -----------------------------------------------------------------------------
# CHECK 10: Validate policy bypass attempts in CLI
# Rule: H-4 (No CLI may bypass policy validators)
# Reference: CLI_COMMAND_OWNERSHIP.md H-4
# Enforcement: Source analysis with comment exclusion
# -----------------------------------------------------------------------------
check_policy_bypass() {
    log_info "Checking for policy bypass attempts..."
    ((TOTAL_CHECKS++)) || true

    local found_violation=false
    local cli_packages
    cli_packages=$(identify_cli_packages)

    if [[ -z "$cli_packages" ]]; then
        log_verbose "No CLI packages found"
        log_success "Policy bypass check skipped (no CLI packages)"
        ((PASSED_CHECKS++)) || true
        return
    fi

    # Policy bypass patterns (as variable assignments or function parameters)
    local -a bypass_patterns=(
        'skipValidation\s*[=:]'
        'bypassPolicy\s*[=:]'
        'SKIP_POLICY\s*[=:]'
        'NO_VALIDATE\s*[=:]'
        'DISABLE_ENFORCEMENT\s*[=:]'
        'forceExecution\s*[=:]'
        '--no-policy'
        '--skip-validation'
        '--bypass-policy'
    )

    while IFS= read -r cli_pkg; do
        [[ -z "$cli_pkg" ]] && continue

        local src_dir="${ROOT_DIR}/${cli_pkg}/src"
        if ! dir_exists "$src_dir"; then
            continue
        fi

        while IFS= read -r src_file; do
            [[ -z "$src_file" ]] && continue

            # Skip test files
            if [[ "$src_file" == *".test."* ]] || [[ "$src_file" == *".spec."* ]]; then
                continue
            fi

            if ! is_executable_code_file "$src_file"; then
                continue
            fi

            for pattern in "${bypass_patterns[@]}"; do
                local matches
                matches=$(grep -nE "$pattern" "$src_file" 2>/dev/null | \
                         grep -v '^\s*//' | \
                         grep -v '^\s*\*' || true)

                if [[ -n "$matches" ]]; then
                    while IFS= read -r match_line; do
                        [[ -z "$match_line" ]] && continue
                        local line_num
                        line_num=$(echo "$match_line" | cut -d: -f1)

                        log_violation "H-4" "CLI_COMMAND_OWNERSHIP.md §Rule H-4" \
                            "$(get_relative_path "$src_file")" \
                            "Policy bypass pattern detected" \
                            "$line_num"
                        found_violation=true
                    done <<< "$matches"
                fi
            done
        done < <(find "$src_dir" -type f \( -name "*.ts" -o -name "*.js" \) 2>/dev/null)
    done <<< "$cli_packages"

    if [[ "$found_violation" == "false" ]]; then
        log_success "No policy bypass attempts detected"
        ((PASSED_CHECKS++)) || true
    fi
}

# -----------------------------------------------------------------------------
# CHECK 11: Validate Cargo.toml dependencies (if Rust packages exist)
# Reference: FORBIDDEN_PATHS.md
# Enforcement: Dependency inspection only
# -----------------------------------------------------------------------------
check_cargo_deps() {
    log_info "Checking Cargo.toml dependencies..."
    ((TOTAL_CHECKS++)) || true

    local cargo_files
    cargo_files=$(find "${ROOT_DIR}" -name "Cargo.toml" \
                  -not -path "*/node_modules/*" \
                  -not -path "*/target/*" 2>/dev/null || true)

    if [[ -z "$cargo_files" ]]; then
        log_verbose "No Cargo.toml files found"
        log_success "Cargo dependency check skipped (no Rust packages)"
        ((PASSED_CHECKS++)) || true
        return
    fi

    local found_violation=false

    while IFS= read -r cargo_file; do
        [[ -z "$cargo_file" ]] && continue

        local pkg_dir
        pkg_dir=$(dirname "$cargo_file")
        local pkg_name
        pkg_name=$(basename "$pkg_dir")

        local deps
        deps=$(get_cargo_deps "$cargo_file")

        # Check if this is a CLI package
        if [[ "$pkg_name" == *"cli"* ]]; then
            for core in "${LAYER3_CORES[@]}"; do
                # Convert to potential Rust crate name
                local rust_name
                rust_name=$(echo "$core" | tr '[:upper:]' '[:lower:]' | tr '-' '_')

                if echo "$deps" | grep -qiE "^${rust_name}$"; then
                    log_violation "INV-9" "DEPENDENCY_GRAPH.md INV-9" \
                        "$(get_relative_path "$cargo_file")" \
                        "Rust CLI has forbidden Layer 3 dependency: ${core}"
                    found_violation=true
                fi
            done
        fi
    done <<< "$cargo_files"

    if [[ "$found_violation" == "false" ]]; then
        log_success "Cargo dependency check passed"
        ((PASSED_CHECKS++)) || true
    fi
}

# -----------------------------------------------------------------------------
# CHECK 12: Validate go.mod dependencies (if Go packages exist)
# Reference: FORBIDDEN_PATHS.md
# Enforcement: Dependency inspection only
# -----------------------------------------------------------------------------
check_go_deps() {
    log_info "Checking go.mod dependencies..."
    ((TOTAL_CHECKS++)) || true

    local go_files
    go_files=$(find "${ROOT_DIR}" -name "go.mod" \
               -not -path "*/node_modules/*" \
               -not -path "*/vendor/*" 2>/dev/null || true)

    if [[ -z "$go_files" ]]; then
        log_verbose "No go.mod files found"
        log_success "Go dependency check skipped (no Go packages)"
        ((PASSED_CHECKS++)) || true
        return
    fi

    local found_violation=false

    while IFS= read -r go_file; do
        [[ -z "$go_file" ]] && continue

        local pkg_dir
        pkg_dir=$(dirname "$go_file")
        local pkg_name
        pkg_name=$(basename "$pkg_dir")

        local deps
        deps=$(get_go_deps "$go_file")

        # Check if this is a CLI package
        if [[ "$pkg_name" == *"cli"* ]]; then
            # Check for simulation/runner patterns
            for sim_repo in "${SIMULATION_REPOS[@]}"; do
                if echo "$deps" | grep -qiF "$sim_repo"; then
                    log_violation "H-1" "CLI_COMMAND_OWNERSHIP.md §Rule H-1" \
                        "$(get_relative_path "$go_file")" \
                        "Go CLI has forbidden simulation dependency: ${sim_repo}"
                    found_violation=true
                fi
            done

            # Check for service patterns
            for service in "${LAYER2_SERVICES[@]}"; do
                if echo "$deps" | grep -qiF "$service"; then
                    log_violation "H-1" "CLI_COMMAND_OWNERSHIP.md §Rule H-1" \
                        "$(get_relative_path "$go_file")" \
                        "Go CLI has forbidden service dependency: ${service}"
                    found_violation=true
                fi
            done
        fi
    done <<< "$go_files"

    if [[ "$found_violation" == "false" ]]; then
        log_success "Go dependency check passed"
        ((PASSED_CHECKS++)) || true
    fi
}

# -----------------------------------------------------------------------------
# CHECK 13: Validate cross-core dependencies
# Rule: INV-4 (Cores cannot import each other directly)
# Reference: DEPENDENCY_GRAPH.md INV-4
# Enforcement: Dependency inspection only
# -----------------------------------------------------------------------------
check_cross_core_deps() {
    log_info "Checking for cross-core dependencies..."
    ((TOTAL_CHECKS++)) || true

    local found_violation=false

    # Find core packages by checking for LLM-*-Core pattern in package names
    while IFS= read -r pkg_json; do
        [[ -z "$pkg_json" ]] && continue

        local pkg_name=""
        if check_jq_available; then
            pkg_name=$(jq -r '.name // empty' "$pkg_json" 2>/dev/null)
        fi

        # Check if this is a core package
        local is_core=false
        for core in "${LAYER3_CORES[@]}"; do
            if [[ "$pkg_name" == "$core" ]] || [[ "$pkg_name" == *"$core"* ]]; then
                is_core=true
                break
            fi
        done

        if [[ "$is_core" != "true" ]]; then
            continue
        fi

        local deps
        deps=$(get_production_deps "$pkg_json")

        # Check for dependencies on other cores
        for other_core in "${LAYER3_CORES[@]}"; do
            # Skip self
            if [[ "$pkg_name" == "$other_core" ]] || [[ "$pkg_name" == *"$other_core"* ]]; then
                continue
            fi

            if echo "$deps" | grep -qxF "$other_core"; then
                log_violation "INV-4" "DEPENDENCY_GRAPH.md INV-4" \
                    "$(get_relative_path "$pkg_json")" \
                    "Cross-core dependency detected: ${pkg_name} depends on ${other_core}"
                found_violation=true
            fi
        done
    done < <(find "${ROOT_DIR}" -maxdepth 3 -name "package.json" \
             -not -path "*/node_modules/*" 2>/dev/null)

    if [[ "$found_violation" == "false" ]]; then
        log_success "No cross-core dependencies detected"
        ((PASSED_CHECKS++)) || true
    fi
}

# -----------------------------------------------------------------------------
# CHECK 14: Validate platform-cli delegation correctness
# Rule: platform-cli must delegate simulation/deployment, not execute directly
# Reference: CLI_COMMAND_OWNERSHIP.md §Exclusivity Statement
# Enforcement: Source code pattern analysis
# -----------------------------------------------------------------------------
check_platform_cli_delegation() {
    log_info "Checking platform-cli delegation correctness..."
    ((TOTAL_CHECKS++)) || true

    local platform_cli_dir="${ROOT_DIR}/packages/platform-cli"
    if ! dir_exists "$platform_cli_dir"; then
        log_verbose "platform-cli not found, skipping delegation check"
        log_success "Platform-CLI delegation check skipped (no platform-cli)"
        ((PASSED_CHECKS++)) || true
        return
    fi

    local found_violation=false

    # Check that delegation commands use forward() pattern
    local delegation_src="${platform_cli_dir}/src/delegation"
    if dir_exists "$delegation_src"; then
        # Verify forwarder.ts exists and has correct pattern
        local forwarder="${delegation_src}/forwarder.ts"
        if file_exists "$forwarder"; then
            # Check that forwarder spawns external process (doesn't import runtime)
            if ! grep -qE "(spawn|exec)\s*\(" "$forwarder"; then
                log_violation "DELEGATION-PATTERN" "CLI_COMMAND_OWNERSHIP.md §Delegation Model" \
                    "$(get_relative_path "$forwarder")" \
                    "Forwarder must use spawn/exec for delegation, not direct imports"
                found_violation=true
            fi
        fi
    fi

    # Check command handlers for direct execution violations
    local commands_dir="${platform_cli_dir}/src/commands"
    if dir_exists "$commands_dir"; then
        # Check for forbidden direct execution patterns in source code
        local -a forbidden_patterns=(
            "runSimulation"
            "executeSimulation"
            "simulationRunner"
            "deploymentExporter"
            "materializeDeployment"
            "writeToDatabase"
            "mutateProduction"
        )

        for pattern in "${forbidden_patterns[@]}"; do
            local matches
            matches=$(grep -rl "$pattern" "$commands_dir" 2>/dev/null | grep -v "\.d\.ts$" | grep -v "node_modules" || true)
            if [[ -n "$matches" ]]; then
                while IFS= read -r file; do
                    [[ -z "$file" ]] && continue
                    log_violation "DIRECT-EXEC" "CLI_COMMAND_OWNERSHIP.md §Exclusivity Statement" \
                        "$(get_relative_path "$file")" \
                        "Direct execution pattern detected: ${pattern}. Must delegate via forward()."
                    found_violation=true
                done <<< "$matches"
            fi
        done

        # Check for database write patterns (forbidden in CLI)
        local db_write_patterns
        db_write_patterns=$(grep -rlE "(\.insert|\.update|\.delete|prisma\.(create|update|delete)|\.save\(\))" "$commands_dir" 2>/dev/null | grep -v "\.d\.ts$" | grep -v "node_modules" || true)
        if [[ -n "$db_write_patterns" ]]; then
            while IFS= read -r file; do
                [[ -z "$file" ]] && continue
                log_violation "DB-MUTATION" "CLI_COMMAND_OWNERSHIP.md §Rule H-6" \
                    "$(get_relative_path "$file")" \
                    "Database mutation detected in CLI. CLIs must not write to databases directly."
                found_violation=true
            done <<< "$db_write_patterns"
        fi
    fi

    if [[ "$found_violation" == "false" ]]; then
        log_success "Platform-CLI delegation correctness verified"
        ((PASSED_CHECKS++)) || true
    fi
}

# -----------------------------------------------------------------------------
# CHECK 15: Validate CLI surface exclusivity
# Rule: Only platform-cli may expose org/env/simulation/deployment commands
# Reference: CLI_COMMAND_OWNERSHIP.md §Exclusivity Statement
# Enforcement: Source code pattern analysis
# -----------------------------------------------------------------------------
check_cli_surface_exclusivity() {
    log_info "Checking CLI surface exclusivity..."
    ((TOTAL_CHECKS++)) || true

    local found_violation=false

    # Define exclusive command surfaces that only platform-cli may expose
    local -a exclusive_patterns=(
        "org.*switch"
        "env.*switch"
        "intent.*promote"
        "simulation.*run"
        "simulate.*execute"
        "deployment.*export"
        "deploy.*materialize"
    )

    # Find all packages except platform-cli
    while IFS= read -r pkg_dir; do
        [[ -z "$pkg_dir" ]] && continue

        # Skip platform-cli (it's the exclusive owner)
        if [[ "$pkg_dir" == *"platform-cli"* ]]; then
            continue
        fi

        # Skip non-CLI packages (only check packages with CLI patterns)
        local pkg_name
        pkg_name=$(basename "$pkg_dir")
        local pkg_json="${pkg_dir}/package.json"

        if ! file_exists "$pkg_json"; then
            continue
        fi

        # Check if package has bin entries (indicating it's a CLI)
        local has_bin=false
        if check_jq_available; then
            if jq -e '.bin' "$pkg_json" &>/dev/null; then
                has_bin=true
            fi
        else
            if grep -q '"bin"' "$pkg_json"; then
                has_bin=true
            fi
        fi

        # Also check for commander/yargs (CLI frameworks)
        local is_cli_like=false
        local deps
        deps=$(get_all_deps "$pkg_json")
        if echo "$deps" | grep -qE "(commander|yargs|oclif|clipanion)"; then
            is_cli_like=true
        fi

        if [[ "$has_bin" != "true" ]] && [[ "$is_cli_like" != "true" ]]; then
            continue
        fi

        # Search for exclusive command patterns in this package's source
        local src_dir="${pkg_dir}/src"
        if ! dir_exists "$src_dir"; then
            continue
        fi

        for pattern in "${exclusive_patterns[@]}"; do
            local matches
            matches=$(grep -rlE "$pattern" "$src_dir" 2>/dev/null | \
                     grep -v "\.d\.ts$" | \
                     grep -v "node_modules" | \
                     grep -v "\.test\." | \
                     grep -v "\.spec\." || true)

            if [[ -n "$matches" ]]; then
                while IFS= read -r file; do
                    [[ -z "$file" ]] && continue

                    # Check if it's actually a command definition (not just a reference)
                    if grep -qE "(command|\.command\(|subcommand)" "$file"; then
                        log_violation "EXCLUSIVITY" "CLI_COMMAND_OWNERSHIP.md §Exclusivity Statement" \
                            "$(get_relative_path "$file")" \
                            "Exclusive command surface '${pattern}' found outside platform-cli. Only agentics-platform-cli may expose this."
                        found_violation=true
                    fi
                done <<< "$matches"
            fi
        done
    done < <(find "${ROOT_DIR}/packages" -mindepth 1 -maxdepth 1 -type d 2>/dev/null)

    if [[ "$found_violation" == "false" ]]; then
        log_success "CLI surface exclusivity verified"
        ((PASSED_CHECKS++)) || true
    fi
}

# ==============================================================================
# SUMMARY AND REPORTING
# ==============================================================================

print_summary() {
    echo ""
    echo -e "${BOLD}═══════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}                    ARCHITECTURE ENFORCEMENT SUMMARY                        ${NC}"
    echo -e "${BOLD}═══════════════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  Script Version:       ${SCRIPT_VERSION}"
    echo -e "  Index Version:        ${EXPECTED_ARCH_VERSION}"
    echo -e "  Frozen Version:       ${EXPECTED_FROZEN_VERSION}"
    echo ""
    echo -e "  Total Checks:    ${TOTAL_CHECKS}"
    echo -e "  ${GREEN}Passed:${NC}          ${PASSED_CHECKS}"
    echo -e "  ${RED}Failed:${NC}          ${FAILED_CHECKS}"
    echo -e "  ${YELLOW}Warnings:${NC}        ${WARNINGS}"
    echo ""

    if [[ ${#VIOLATIONS[@]} -gt 0 ]]; then
        echo -e "${BOLD}${RED}VIOLATIONS DETECTED:${NC}"
        echo ""

        for i in "${!VIOLATIONS[@]}"; do
            IFS='|' read -r rule doc_ref location message <<< "${VIOLATIONS[$i]}"
            echo -e "  ${RED}$((i+1)). [${rule}]${NC}"
            echo -e "     ${DIM}Document:${NC}  ${doc_ref}"
            echo -e "     ${DIM}Location:${NC}  ${location}"
            echo -e "     ${DIM}Message:${NC}   ${message}"
            echo ""
        done
    fi

    echo -e "${BOLD}Canonical Reference Documents:${NC}"
    echo "  0. ARCHITECTURE_VERSION.md (frozen version declaration)"
    echo "  1. architecture/ARCHITECTURE_INDEX.md (precedence hierarchy)"
    echo "  2. architecture/DEPENDENCY_GRAPH.md (layer rules)"
    echo "  3. architecture/FORBIDDEN_PATHS.md (explicit prohibitions)"
    echo "  4. architecture/REPO_CLASSIFICATION.md (repository classes)"
    echo "  5. architecture/CLI_COMMAND_OWNERSHIP.md (CLI boundaries)"
    echo ""

    if [[ "$FIX_SUGGESTIONS" == "true" ]] && [[ ${#VIOLATIONS[@]} -gt 0 ]]; then
        echo -e "${BOLD}REMEDIATION GUIDANCE:${NC}"
        echo ""
        echo "  1. Remove forbidden dependencies from package.json/Cargo.toml/go.mod"
        echo "  2. Replace direct Layer 3 imports with Layer 4 API calls"
        echo "  3. Delegate simulation/deployment to designated Layer 4 repositories"
        echo "  4. Route cross-core operations through Layer 4 API Gateway"
        echo "  5. Reference architecture/ARCHITECTURE_INDEX.md for amendment process"
        echo ""
        echo -e "${DIM}  Note: Exceptions require ADR amendment with CTO approval.${NC}"
        echo ""
    fi

    echo -e "${BOLD}═══════════════════════════════════════════════════════════════════════════${NC}"
}

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --verbose|-v)
                VERBOSE=true
                shift
                ;;
            --fix-suggestions|-f)
                FIX_SUGGESTIONS=true
                shift
                ;;
            --help|-h)
                echo "Agentics Platform Architecture Enforcement Gate"
                echo ""
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --verbose, -v         Enable verbose output with debug information"
                echo "  --fix-suggestions, -f Show remediation guidance for violations"
                echo "  --help, -h            Show this help message"
                echo ""
                echo "Exit Codes:"
                echo "  0  All checks passed"
                echo "  1  Architecture violation detected"
                echo "  2  Script execution error (missing documents, parse failure)"
                echo ""
                echo "Canonical Documents (in precedence order):"
                echo "  1. ARCHITECTURE_INDEX.md"
                echo "  2. DEPENDENCY_GRAPH.md"
                echo "  3. FORBIDDEN_PATHS.md"
                echo "  4. REPO_CLASSIFICATION.md"
                echo "  5. CLI_COMMAND_OWNERSHIP.md"
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                echo "Use --help for usage information"
                exit 2
                ;;
        esac
    done
}

verify_prerequisites() {
    # Verify we're in a valid project
    if ! file_exists "${ROOT_DIR}/package.json"; then
        log_fatal "No package.json found in root. Are you in the correct directory?"
    fi

    # Verify all required architecture documents exist
    # CRITICAL: ARCHITECTURE_VERSION.md at root is required for governance
    local -a required_docs=(
        "$ARCH_VERSION"
        "$ARCH_INDEX"
        "$REPO_CLASS"
        "$DEPENDENCY_GRAPH"
        "$FORBIDDEN_PATHS"
        "$CLI_OWNERSHIP"
    )

    local missing_critical=false
    for doc in "${required_docs[@]}"; do
        if ! file_exists "$doc"; then
            log_error "Required architecture document not found: $(get_relative_path "$doc")"
            missing_critical=true
        fi
    done

    if [[ "$missing_critical" == "true" ]]; then
        log_fatal "CRITICAL: One or more required architecture documents are missing. CI cannot proceed."
    fi

    log_verbose "All prerequisite architecture documents present"
}

main() {
    parse_args "$@"

    echo ""
    echo -e "${BOLD}Agentics Platform Architecture Enforcement Gate${NC}"
    echo -e "Version: ${SCRIPT_VERSION}"
    echo -e "Root: ${ROOT_DIR}"
    echo ""

    # Verify prerequisites
    verify_prerequisites

    # Parse canonical classifications from architecture documents
    log_info "Loading canonical classifications from architecture documents..."
    parse_repo_classifications

    echo ""
    echo -e "${BOLD}Starting architectural validation...${NC}"
    echo ""

    # Run all checks in order
    # Phase 1: Document validation (hard-fail if missing or invalid)
    check_architecture_version_file
    check_architecture_version
    check_cross_document_consistency
    check_cli_ownership_rules

    # Phase 2: Dependency validation
    check_cli_layer3_deps
    check_cli_forbidden_deps
    check_cli_simulation_execution
    check_deployment_materialization
    check_upward_dependencies
    check_layer_skip
    check_infrastructure_isolation
    check_simulation_isolation
    check_integration_statelessness
    check_policy_bypass
    check_cargo_deps
    check_go_deps
    check_cross_core_deps

    # Phase 3: CLI exclusivity and delegation validation
    check_platform_cli_delegation
    check_cli_surface_exclusivity

    # Print summary
    print_summary

    # Exit with appropriate code
    if [[ $FAILED_CHECKS -gt 0 ]]; then
        echo -e "${RED}${BOLD}ARCHITECTURE CHECK FAILED${NC}"
        echo "Fix the violations above before merging."
        echo ""
        exit 1
    else
        echo -e "${GREEN}${BOLD}ARCHITECTURE CHECK PASSED${NC}"
        echo "All architectural constraints satisfied."
        echo ""
        exit 0
    fi
}

# Run main function
main "$@"
