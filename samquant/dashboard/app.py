"""Streamlit dashboard entry point."""

from __future__ import annotations

import streamlit as st


def main() -> None:
    """Render the SamQuant dashboard shell."""
    st.set_page_config(page_title="SamQuant", page_icon="SQ", layout="wide")
    st.title("SamQuant")
    st.caption("Algorithmic Trading System & Backtesting Engine")
    st.info("Dashboard components will be added after the engine and analytics phases.")


if __name__ == "__main__":
    main()

