:: p+a-s.sage_Id [ layoutName  ] [ tag1 ,  tag2, tag3]

@{onEnter}
$a = b; _c = d
$e = f; 
console.log("stubborn")
@{end}

// only use salttriangle language here
@{slot1}
<div class="${=$someVariable}">
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
@{  0.0--+  }
why you name layout like that.
#{ "desc" | "passageId" }{ // this is link button
    $aa += 1
}
#{$somevariable["someS"]|"guagua"} { /* you should always add {} */}<br>
    #{"addMoney"}{
        // 基於我懶得解決的原因 link js code highlight不會正確上成js顏色
        /* this would js block(can handle $ and _ variable)*/
        $money += 50
    }
@{end}

:: 0.0 [layout+-.]
@{0.0--+}
    ${if $money >= _random}
        you so rich!
    ${elif $money <= _default}
        you so poor!
    ${/if}
    your skin color is ${ = $player.apperance["skinColor"]}

${for _id, _b in _hasSave}
    <div class='lg-slot'>
        <div class="lg-slot-info">
            <div>槽位 ${= _id}</div>
            <div>${if _b}${= _date[_id]}${else}空位${/if}</div>
        </div>
        <div class="lg-slot-actions">
            ${if _b}
                <button class="lg-load-btn" onclick="engine.load('${= _id}')">讀取</button>
            ${else}
                <button class="lg-load-btn" disabled>讀取</button>
            ${/if}
        </div>
    </div>
${/for}
@{end}