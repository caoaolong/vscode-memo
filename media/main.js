layui.use(['layer', 'form', 'util'], function() {
    const layer = layui.layer;
    const vscode = acquireVsCodeApi();

    const $authContainer = $('#auth-container');
    const $mainContainer = $('#main-container');
    const $settingsContainer = $('#settings-container');
    const $authTitle = $('#auth-title');
    const $passwordInput = $('#password-input');
    const $memoList = $('#memo-list');
    const $addMemoCard = $('#add-memo-card');
    const $layoutToggle = $('#layout-toggle');

    let currentLayout = 'list';
    let hasPassword = false;

    // Initial data fetch
    vscode.postMessage({ type: 'getData' });

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
            case 'initData':
                hasPassword = message.hasPassword;
                currentLayout = message.layout;
                if (!hasPassword) {
                    $authContainer.removeClass('hidden');
                    $authTitle.text('设置访问密码');
                } else {
                    $authContainer.removeClass('hidden');
                    $authTitle.text('输入密码进入');
                }
                updateLayout(currentLayout);
                renderMemos(message.memos);
                break;
            case 'passwordSet':
                hasPassword = true;
                showMain();
                break;
            case 'authSuccess':
                showMain();
                break;
            case 'authFail':
                layer.msg('密码错误！', { icon: 2 });
                $passwordInput.val('');
                break;
            case 'updateMemos':
                renderMemos(message.memos);
                break;
        }
    });

    $('#auth-btn').on('click', () => {
        const password = $passwordInput.val();
        if (!password) {
            layer.msg('请输入密码');
            return;
        }
        if (!hasPassword) {
            vscode.postMessage({ type: 'setPassword', password });
        } else {
            vscode.postMessage({ type: 'verifyPassword', password });
        }
    });

    $passwordInput.on('keypress', (e) => {
        if (e.key === 'Enter') {
            $('#auth-btn').click();
        }
    });

    function showMain() {
        $authContainer.addClass('hidden');
        $settingsContainer.addClass('hidden');
        $mainContainer.removeClass('hidden');
    }

    function renderMemos(memos) {
        $memoList.find('.memo-card:not(.add-card)').remove();

        memos.forEach(memo => {
            const $card = $(`
                <div class="memo-card" style="background-color: ${memo.color}">
                    <h4>${memo.title || '无标题'}</h4>
                    <p>${memo.content || ''}</p>
                    <div class="delete-btn" title="删除">×</div>
                </div>
            `);
            
            $card.find('.delete-btn').on('click', (e) => {
                e.stopPropagation();
                vscode.postMessage({ type: 'deleteMemo', id: memo.id });
            });

            $card.on('click', () => {
                // Future: view/edit memo
                layer.open({
                    type: 1,
                    title: memo.title || '详情',
                    area: ['90%', '80%'],
                    content: `<div style="padding: 15px;">${memo.content}</div>`,
                    shadeClose: true
                });
            });

            $card.insertBefore($addMemoCard);
        });
    }

    $addMemoCard.on('click', () => {
        vscode.postMessage({ type: 'openAddMemo' });
    });

    $layoutToggle.on('click', () => {
        currentLayout = currentLayout === 'list' ? 'grid' : 'list';
        updateLayout(currentLayout);
        vscode.postMessage({ type: 'setLayout', layout: currentLayout });
    });

    function updateLayout(layout) {
        if (layout === 'grid') {
            $memoList.removeClass('list-layout').addClass('grid-layout');
            $layoutToggle.attr('src', $layoutToggle.data('list'));
        } else {
            $memoList.removeClass('grid-layout').addClass('list-layout');
            $layoutToggle.attr('src', $layoutToggle.data('grid'));
        }
    }

    $('#settings-btn').on('click', () => {
        $mainContainer.addClass('hidden');
        $settingsContainer.removeClass('hidden');
    });

    $('#back-btn').on('click', () => {
        $settingsContainer.addClass('hidden');
        $mainContainer.removeClass('hidden');
    });

    $('#reset-password-btn').on('click', () => {
        layer.prompt({ title: '输入新密码', formType: 1 }, function(pass, index) {
            vscode.postMessage({ type: 'setPassword', password: pass });
            layer.close(index);
            layer.msg('密码已重置');
        });
    });

    $('#clear-all-btn').on('click', () => {
        layer.confirm('确定要清空所有备忘录吗？', { icon: 3, title: '警告' }, function(index) {
            // Need to implement clearAll in Provider
            // vscode.postMessage({ type: 'clearAll' });
            layer.msg('该功能需后端支持');
            layer.close(index);
        });
    });
});
