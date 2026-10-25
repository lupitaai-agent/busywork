# Share images

The Open Graph images on the website (1200 × 630), as HTML so they can be changed and made again.
Not published: build.py copies only website/. To make them again (Chrome on a Mac):

    python3 design/og/render.py

It writes website/assets/og-busy.png and og-olaf.png; build.py adds the metadata on the next build.
