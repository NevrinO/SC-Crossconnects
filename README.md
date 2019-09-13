# SC-Crossconnects
Program that gets lengths needed for a XC


-This is a work in progress - USE AT YOUR OWN RISK!!!
-It is highly recommended to double check length, at least for now!
-There are almost no checks on what is entered so feed it crazy stuff and it will give you crazy answers
-There are no checks to ensure the path is in the same room as the cabs so ensure the correct room and path are selected or you may get some interesting results
-Do not use for network to network as the lengths assume the cable will be ran along fiber-tray/ladder-rack.
-Do not use for in the same cab as it will be too long.
-Do not use for precabled (under floor). These are for cables ran overhead using ether the fiber tray or the ladder-rack.
-These expect the cab's patch panel to be in U46 (+/- 1U should have no effect) and so if needed to run down lower add the distance to the Slack field
-Some slack is added by default to deal with cabs not being exactly lined up with tiles. this should leave a run with 1-3ft of extra cable depending on where both cabs are. This extra can be ate up easily thus assume for now that this is minimum length.
-Starting rack and Ending rack are case insensitive
-Order of start cab and end cab does not matter (or at least should not)
-If more then 1 backtrack path is required to reach cab add length from end cab to that backtrack point x2 to the slack field for each additional backtrack (at this point it might be easier to do by hand)
