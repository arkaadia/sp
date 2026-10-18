#!/usr/bin/env bash
# ==============================================================================
# DELAVAR STUDIO — Unified Terminal Banner
# ==============================================================================
# Displays the official 42-style DELAVAR STUDIO banner for Elysian Sprite Studio
# installer and uninstaller scripts. Supports responsive terminal width auto-detection,
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
    local ACCENT_COLOR=""
    local RESET=""

    if [ "$is_term" -eq 1 ]; then
        RESET="\033[0m"
        if [[ "$mode" == "uninstall" ]]; then
            # Bold Bright White for Uninstaller
            PRIMARY_COLOR="\033[1;97m"
            FRAME_COLOR="\033[0;37m"
            ACCENT_COLOR="\033[1;37m"
        else
            # Bold Bright Blue for Installer
            PRIMARY_COLOR="\033[1;94m"
            FRAME_COLOR="\033[0;34m"
            ACCENT_COLOR="\033[1;36m"
        fi
    fi

    # Subtitle configuration
    local subtitle="✦  ELYSIAN SPRITE STUDIO  •  LINUX INSTALLER  ✦"
    if [[ "$mode" == "uninstall" ]]; then
        subtitle="✦  ELYSIAN SPRITE STUDIO  •  LINUX UNINSTALLER  ✦"
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

    # Official 7-line DELAVAR STUDIO banner art
    local u0="::::::      :::::::::  :::::::::: :::            :::     :::     :::     :::     :::::::::        :::::::: ::::::::::: :::    ::: ::::::::: ::::::::::: ::::::::       ::::::"
    local u1=":+:         :+:    :+: :+:        :+:          :+: :+:   :+:     :+:   :+: :+:   :+:    :+:      :+:    :+:    :+:     :+:    :+: :+:    :+:    :+:    :+:    :+:         :+:"
    local u2="+:+         +:+    +:+ +:+        +:+         +:+   +:+  +:+     +:+  +:+   +:+  +:+    +:+      +:+           +:+     +:+    +:+ +:+    +:+    +:+    +:+    +:+         +:+"
    local u3="+#+         +#+    +:+ +#++:++#   +#+        +#++:++#++: +#+     +:+ +#++:++#++: +#++:++#:       +#++:++#++    +#+     +#+    +:+ +#+    +:+    +#+    +#+    +:+         +#+"
    local u4="+#+         +#+    +#+ +#+        +#+        +#+     +#+  +#+   +#+  +#+     +#+ +#+    +#+             +#+    +#+     +#+    +#+ +#+    +#+    +#+    +#+    +:+         +#+"
    local u5="#+#         #+#    #+# #+#        #+#        #+#     #+#   #+#+#+#   #+#     #+# #+#    #+#      #+#    #+#    #+#     #+#    #+# #+#    #+#    #+#    #+#    #+#         #+#"
    local u6="######      #########  ########## ########## ###     ###     ###     ###     ### ###    ###       ########     ###      ########  ######### ########### ########       ######"

    # Banner rendering with error suppression to prevent script interruption
    {
        if [ "$cols" -ge 177 ]; then
            # Full 173-column single-line banner for widescreen terminals
            local inner_w=175
            local total_w=177
            local pad=$(( (cols - total_w) / 2 ))
            local pad_str=""
            [ "$pad" -gt 0 ] && pad_str=$(printf '%*s' "$pad" "")
            local border
            border=$(printf '─%.0s' $(seq 1 "$inner_w"))

            local sub_len=${#subtitle}
            local sub_pad=$(( (inner_w - sub_len) / 2 ))
            local sub_left=""
            local sub_right=""
            [ "$sub_pad" -gt 0 ] && sub_left=$(printf '%*s' "$sub_pad" "")
            [ "$sub_pad" -gt 0 ] && sub_right=$(printf '%*s' $((inner_w - sub_len - sub_pad)) "")

            echo ""
            echo -e "${pad_str}${FRAME_COLOR}┌${border}┐${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}│$(printf '%*s' "$inner_w" "")│${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}│ ${RESET}${PRIMARY_COLOR}${u0}${RESET} ${FRAME_COLOR}│${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}│ ${RESET}${PRIMARY_COLOR}${u1}${RESET} ${FRAME_COLOR}│${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}│ ${RESET}${PRIMARY_COLOR}${u2}${RESET} ${FRAME_COLOR}│${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}│ ${RESET}${PRIMARY_COLOR}${u3}${RESET} ${FRAME_COLOR}│${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}│ ${RESET}${PRIMARY_COLOR}${u4}${RESET} ${FRAME_COLOR}│${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}│ ${RESET}${PRIMARY_COLOR}${u5}${RESET} ${FRAME_COLOR}│${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}│ ${RESET}${PRIMARY_COLOR}${u6}${RESET} ${FRAME_COLOR}│${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}│$(printf '%*s' "$inner_w" "")│${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}├${border}┤${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}│${RESET}${ACCENT_COLOR}${sub_left}${subtitle}${sub_right}${RESET}${FRAME_COLOR}│${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}└${border}┘${RESET}"
            echo ""
        else
            # Standard terminal (80-120 columns): Stack DELAVAR & STUDIO perfectly without wrapping
            local d0=":::::::::  :::::::::: :::            :::     :::     :::     :::     :::::::::"
            local d1=":+:    :+: :+:        :+:          :+: :+:   :+:     :+:   :+: :+:   :+:    :+:"
            local d2="+:+    +:+ +:+        +:+         +:+   +:+  +:+     +:+  +:+   +:+  +:+    +:+"
            local d3="+#+    +:+ +#++:++#   +#+        +#++:++#++: +#+     +:+ +#++:++#++: +#++:++#:"
            local d4="+#+    +#+ +#+        +#+        +#+     +#+  +#+   +#+  +#+     +#+ +#+    +#+"
            local d5="#+#    #+# #+#        #+#        #+#     #+#   #+#+#+#   #+#     #+# #+#    #+#"
            local d6="#########  ########## ########## ###     ###     ###     ###     ### ###    ###"

            local s0="       :::::::: ::::::::::: :::    ::: ::::::::: ::::::::::: ::::::::"
            local s1="      :+:    :+:    :+:     :+:    :+: :+:    :+:    :+:    :+:    :+:"
            local s2="      +:+           +:+     +:+    +:+ +:+    +:+    +:+    +:+    +:+"
            local s3="      +#++:++#++    +#+     +#+    +:+ +#+    +:+    +#+    +#+    +:+"
            local s4="             +#+    +#+     +#+    +#+ +#+    +#+    +#+    +#+    +#+"
            local s5="      #+#    #+#    #+#     #+#    #+# #+#    #+#    #+#    #+#    +#+"
            local s6="       ########     ###      ########  ######### ########### ########"

            local inner_w=81
            local total_w=83
            local pad=0
            [ "$cols" -gt "$total_w" ] && pad=$(( (cols - total_w) / 2 ))
            local pad_str=""
            [ "$pad" -gt 0 ] && pad_str=$(printf '%*s' "$pad" "")
            local border
            border=$(printf '─%.0s' $(seq 1 "$inner_w"))

            local sub_len=${#subtitle}
            local sub_pad=0
            [ "$inner_w" -gt "$sub_len" ] && sub_pad=$(( (inner_w - sub_len) / 2 ))
            local sub_left=""
            local sub_right=""
            [ "$sub_pad" -gt 0 ] && sub_left=$(printf '%*s' "$sub_pad" "")
            [ "$sub_pad" -gt 0 ] && sub_right=$(printf '%*s' $((inner_w - sub_len - sub_pad)) "")

            echo ""
            echo -e "${pad_str}${FRAME_COLOR}┌${border}┐${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}│$(printf '%*s' "$inner_w" "")│${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}│ ${RESET}${PRIMARY_COLOR}${d0}${RESET} ${FRAME_COLOR}│${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}│ ${RESET}${PRIMARY_COLOR}${d1}${RESET} ${FRAME_COLOR}│${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}│ ${RESET}${PRIMARY_COLOR}${d2}${RESET} ${FRAME_COLOR}│${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}│ ${RESET}${PRIMARY_COLOR}${d3}${RESET} ${FRAME_COLOR}│${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}│ ${RESET}${PRIMARY_COLOR}${d4}${RESET} ${FRAME_COLOR}│${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}│ ${RESET}${PRIMARY_COLOR}${d5}${RESET} ${FRAME_COLOR}│${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}│ ${RESET}${PRIMARY_COLOR}${d6}${RESET} ${FRAME_COLOR}│${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}│$(printf '%*s' "$inner_w" "")│${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}│ ${RESET}${PRIMARY_COLOR}${s0}        ${RESET} ${FRAME_COLOR}│${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}│ ${RESET}${PRIMARY_COLOR}${s1}        ${RESET} ${FRAME_COLOR}│${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}│ ${RESET}${PRIMARY_COLOR}${s2}        ${RESET} ${FRAME_COLOR}│${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}│ ${RESET}${PRIMARY_COLOR}${s3}        ${RESET} ${FRAME_COLOR}│${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}│ ${RESET}${PRIMARY_COLOR}${s4}        ${RESET} ${FRAME_COLOR}│${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}│ ${RESET}${PRIMARY_COLOR}${s5}        ${RESET} ${FRAME_COLOR}│${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}│ ${RESET}${PRIMARY_COLOR}${s6}        ${RESET} ${FRAME_COLOR}│${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}│$(printf '%*s' "$inner_w" "")│${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}├${border}┤${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}│${RESET}${ACCENT_COLOR}${sub_left}${subtitle}${sub_right}${RESET}${FRAME_COLOR}│${RESET}"
            echo -e "${pad_str}${FRAME_COLOR}└${border}┘${RESET}"
            echo ""
        fi
    } 2>/dev/null || true
}

# If executed directly as a script
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    show_delavar_banner "${1:-install}"
fi
