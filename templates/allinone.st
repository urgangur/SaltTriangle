:: p+a-s.sage_Id [layoutName] [tag1, tag2]
// use js in onEnter and onExit(can handle $ and _ variable)
@{onEnter}
$a = b; _c = d
variable().e = f
@{end}

// only use salttriangle language here
@{slot1}
<div class="$someVariable">
you have ${=$money} dollars.<br>
that's a lot of money.
</div>
@{end}

@{slot2}
you have
${for _i, _v in $backpack}
	${ if _v != "abc"}
		${=_v},
	${elif _v == "sword"}
		<b>${=_v}</b>,
	${else}
		${=_v}
	${/if}
${/for}
in the backpack.
@{end}

@{onExit}
@{end}

:: noTagPassage [layout+-.]
@{0.0--+}
why you name layout like that.
#{"desc"|"passageId"}{ // this is link button
    $aa += 1
}
#{$somevariable|"guagua"}{ \* you should always add {} *\}<br>
#{"addMoney"}{
    /* this would js block(can handle $ and _ variable)*/
    $money += 50
}
@{end}

:: mathThing [layout+-.]
@{0.0--+}
    ${if $money >= _random}
        you so rich!
    ${/if}
    your skin color is ${=$player.apperance["skinColor"]}
@{end}