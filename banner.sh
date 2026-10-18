#!/usr/bin/env bash
# ==============================================================================
# DELAVAR STUDIO — Unified Terminal Banner
# ==============================================================================
# Displays a professional centered ASCII banner for Elysian Sprite Studio
# installer and uninstaller scripts. Supports terminal width auto-detection,
# color suppression for non-interactive pipes, and graceful error recovery.
# ==============================================================================

show_delavar_banner() {
    local mode="${1:-install}"

    # Determine if stdout is a real terminal and supports color
    local is_term=0
    if [ -t 1 ] && [ "${TERM:-}" != "dumb" ]; then
        is_term=1
    fi

    # ANSI Colors
    local PRIMARY_COLOR=""
    local FRAME_COLOR=""
    local RESET=""

    if [ "$is_term" -eq 1 ]; then
        RESET="\033[0m"
        if [[ "$mode" == "uninstall" ]]; then
            # Bold Bright White for Uninstaller
            PRIMARY_COLOR="\033[1;97m"
            FRAME_COLOR="\033[0;37m"
        else
            # Bold Bright Blue for Installer
            PRIMARY_COLOR="\033[1;94m"
            FRAME_COLOR="\033[0;34m"
        fi
    fi

    # Subtitle configuration
    local subtitle="ELYSIAN SPRITE STUDIO • LINUX INSTALLER"
    if [[ "$mode" == "uninstall" ]]; then
        subtitle="ELYSIAN SPRITE STUDIO • LINUX UNINSTALLER"
    fi

    # Detect terminal columns (fallback to 80)
    local cols=80
    if [ "$is_term" -eq 1 ] && command -v tput >/dev/null 2>&1; then
        cols=$(tput cols 2>/dev/null || echo 80)
    elif [ -n "${COLUMNS:-}" ]; then
        cols="$COLUMNS"
    fi
    [[ "$cols" =~ ^[0-9]+$ ]] || cols=80
    [ "$cols" -lt 40 ] && cols=80

    # Layout dimensions: inner width 75, total box width 77
    local inner_width=75
    local total_width=$((inner_width + 2))
    local pad=0
    if [ "$cols" -gt "$total_width" ]; then
        pad=$(( (cols - total_width) / 2 ))
    fi

    local pad_str=""
    if [ "$pad" -gt 0 ]; then
        pad_str=$(printf '%*s' "$pad" "")
    fi

    local border_line
    border_line=$(printf '─%.0s' $(seq 1 "$inner_width"))

    local sub_len=${#subtitle}
    local sub_pad=0
    if [ "$inner_width" -gt "$sub_len" ]; then
        sub_pad=$(( (inner_width - sub_len) / 2 ))
    fi
    local sub_pad_left=""
    local sub_pad_right=""
    if [ "$sub_pad" -gt 0 ]; then
        sub_pad_left=$(printf '%*s' "$sub_pad" "")
        sub_pad_right=$(printf '%*s' $((inner_width - sub_len - sub_pad)) "")
    fi

    # Banner rendering with error suppression to prevent script interruption
    {
        echo ""
        echo -e "${pad_str}${FRAME_COLOR}┌${border_line}┐${RESET}"
        echo -e "${pad_str}${FRAME_COLOR}│$(printf '%*s' "$inner_width" "")│${RESET}"

        # 5 rows of DELAVAR STUDIO FIGlet art (padded to exactly 75 chars)
        local r1="  ____  _____ _       ___   __   _    ____  ____ _____ _   _ ____ ___ ___   "
        local r2=" |  _ \| ____| |     / \ \ / /  / \  |  _ \/ ___|_   _| | | |  _ \_ _/ _ \  "
        local r3=" | | | |  _| | |    / _ \ V /  / _ \ | |_) \___ \ | | | | | | | | | | | | | "
        local r4=" | |_| | |___| |___/ ___ \| | / ___ \|  _ < ___) || | | |_| | |_| | | |_| | "
        local r5=" |____/|_____|____/_/   \_\_|/_/   \_\_| \_|____/ |_|  \___/|____/___|___/  "

        echo -e "${pad_str}${FRAME_COLOR}│${RESET}${PRIMARY_COLOR}${r1}${RESET}${FRAME_COLOR}│${RESET}"
        echo -e "${pad_str}${FRAME_COLOR}│${RESET}${PRIMARY_COLOR}${r2}${RESET}${FRAME_COLOR}│${RESET}"
        echo -e "${pad_str}${FRAME_COLOR}│${RESET}${PRIMARY_COLOR}${r3}${RESET}${FRAME_COLOR}│${RESET}"
        echo -e "${pad_str}${FRAME_COLOR}│${RESET}${PRIMARY_COLOR}${r4}${RESET}${FRAME_COLOR}│${RESET}"
        echo -e "${pad_str}${FRAME_COLOR}│${RESET}${PRIMARY_COLOR}${r5}${RESET}${FRAME_COLOR}│${RESET}"

        echo -e "${pad_str}${FRAME_COLOR}│$(printf '%*s' "$inner_width" "")│${RESET}"
        echo -e "${pad_str}${FRAME_COLOR}├${border_line}┤${RESET}"
        echo -e "${pad_str}${FRAME_COLOR}│${RESET}${PRIMARY_COLOR}${sub_pad_left}${subtitle}${sub_pad_right}${RESET}${FRAME_COLOR}│${RESET}"
        echo -e "${pad_str}${FRAME_COLOR}└${border_line}┘${RESET}"
        echo ""
    } 2>/dev/null || true
}

# If executed directly as a script
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    show_delavar_banner "${1:-install}"
fi
