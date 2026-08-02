# Cross-session handoff

**Slug:** tab-scroll-restore  
**Phase:** implement complete (commits deferred; ready for grokbit-test / manual multi-tab check)  
**Open:** human visual of hide→reveal mid-scroll vs pin; optional rebuild/install  
**Blocked:** none  

## Summary
Session tabs restore scroll after webview tear-down: host holds stick+scrollTop; begin/end panel replay suppresses auto-scroll during buffer rebuild; mid-scroll restores; pin stays at bottom for new AI content.
